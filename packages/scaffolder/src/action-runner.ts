import crypto from 'node:crypto';
import type { Pool } from 'pg';
import type { Logger } from '@forgeportal/core';
import type { SCMProviders } from '@forgeportal/scm';
import { ActionRunRepository, type ActionRun } from './action-run.repository.js';
import { ActionRunLogRepository } from './action-run-log.repository.js';
import { AuditLogRepository } from './audit-log.repository.js';
import { createActionContext } from './action-context.js';
import type { ActionRegistry } from './action-registry.js';
import { ActionError, type ActionResult } from './types.js';
import type { TemplateOrchestrator } from './template-orchestrator.js';

export interface ActionRunnerOptions {
  concurrency?: number;
  pollIntervalMs?: number;
  orchestrator?: TemplateOrchestrator;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ActionRunner {
  private running = false;
  private activeCount = 0;
  private readonly workerId: string;
  private readonly concurrency: number;
  private readonly pollIntervalMs: number;
  private readonly runRepo: ActionRunRepository;
  private readonly logRepo: ActionRunLogRepository;
  private readonly auditRepo: AuditLogRepository;
  private readonly orchestrator?: TemplateOrchestrator;

  constructor(
    private readonly pool: Pool,
    private readonly registry: ActionRegistry,
    private readonly _scmProviders: SCMProviders,
    private readonly logger: Logger,
    options?: ActionRunnerOptions,
  ) {
    this.workerId = `action-runner-${crypto.randomUUID().slice(0, 8)}`;
    this.concurrency = options?.concurrency ?? 5;
    this.pollIntervalMs = options?.pollIntervalMs ?? 1_000;
    this.orchestrator = options?.orchestrator;
    this.runRepo = new ActionRunRepository(pool);
    this.logRepo = new ActionRunLogRepository(pool);
    this.auditRepo = new AuditLogRepository(pool);
  }

  async start(): Promise<void> {
    this.running = true;
    this.logger.info({ workerId: this.workerId }, 'ActionRunner started');

    while (this.running) {
      if (this.activeCount < this.concurrency) {
        try {
          const run = await this.runRepo.claimNext(this.workerId);
          if (run) {
            this.activeCount++;
            void this.executeRun(run).finally(() => {
              this.activeCount--;
            });
          } else {
            await sleep(this.pollIntervalMs);
          }
        } catch (err) {
          this.logger.error({ err }, 'ActionRunner: error claiming next run');
          await sleep(this.pollIntervalMs);
        }
      } else {
        await sleep(100);
      }
    }
  }

  stop(): void {
    this.running = false;
    this.logger.info({ workerId: this.workerId }, 'ActionRunner stopping');
  }

  /**
   * Fire-and-forget audit log write — errors are logged but never re-thrown.
   * Only called on terminal states (success or final failure), never on retries.
   */
  private async writeAuditLog(
    run: ActionRun,
    actionName: string,
    result: ActionResult | null,
    error?: string,
  ): Promise<void> {
    const status = result?.status ?? 'failed';
    try {
      await this.auditRepo.append({
        actor: run.requested_by,
        action: actionName,
        target_type: 'action_run',
        target_id: run.id,
        metadata: {
          run_id: run.id,
          entity_id: run.entity_id ?? null,
          status,
          outputs: result?.outputs ?? {},
          links: result?.links ?? [],
          warnings: result?.warnings ?? [],
          error: error ?? null,
        },
      });
    } catch (auditErr) {
      this.logger.error(
        { auditErr, runId: run.id },
        'Failed to write audit log — continuing',
      );
    }
  }

  /**
   * Forward template run advancement to the orchestrator (fire-and-forget error handling).
   * Only called on terminal states — never on retries.
   */
  private async advanceTemplate(
    run: ActionRun,
    result: ActionResult | null,
    failed: boolean,
  ): Promise<void> {
    if (!run.template_run_id || !this.orchestrator) return;
    await this.orchestrator
      .advanceTemplateRun(
        run.template_run_id,
        run.step_id ?? 'unknown',
        result,
        failed,
      )
      .catch((err: unknown) => {
        this.logger.error(
          { err, templateRunId: run.template_run_id },
          'Template orchestration error — runner continues',
        );
      });
  }

  private async executeRun(run: ActionRun): Promise<void> {
    const ctx = createActionContext(run, this.pool, this.logRepo, this.logger);

    // Declare outside try so catch/finally can access for audit log
    let actionFullName = 'unknown@unknown';

    try {
      // Resolve action name from actions table
      const actionRow = await this.pool.query<{
        name: string;
        version: string;
      }>('SELECT name, version FROM actions WHERE id = $1', [run.action_id]);

      if (actionRow.rows.length === 0) {
        const msg = `Action not found in actions table: ${run.action_id ?? 'null'}`;
        this.logger.warn({ runId: run.id, actionId: run.action_id }, msg);
        await this.runRepo.markFailedOrRetry(run.id, msg, run);
        if (run.retry_count >= run.max_retries) {
          await this.writeAuditLog(run, actionFullName, null, msg);
        }
        return;
      }

      const { name, version } = actionRow.rows[0];
      actionFullName = `${name}@${version}`;

      const handler = this.registry.get(actionFullName);
      if (!handler) {
        const msg = `No handler registered for action: ${actionFullName}`;
        this.logger.warn({ runId: run.id, handlerKey: actionFullName }, msg);
        await this.runRepo.markFailedOrRetry(run.id, msg, run);
        if (run.retry_count >= run.max_retries) {
          await this.writeAuditLog(run, actionFullName, null, msg);
        }
        return;
      }

      const result = await handler.execute(ctx);

      if (result.status === 'success') {
        await this.runRepo.markSuccess(run.id, result.outputs);
        this.logger.info(
          { runId: run.id, handlerKey: actionFullName },
          'Action run succeeded',
        );
        await this.writeAuditLog(run, actionFullName, result);
        await this.advanceTemplate(run, result, false);
      } else {
        const errMsg = result.error ?? 'Action returned failed status';
        const isTerminalFailure = run.retry_count >= run.max_retries;
        await this.runRepo.markFailedOrRetry(run.id, errMsg, run);
        this.logger.warn(
          { runId: run.id, handlerKey: actionFullName },
          'Action run failed',
        );
        if (isTerminalFailure) {
          await this.writeAuditLog(run, actionFullName, null, errMsg);
          await this.advanceTemplate(run, null, true);
        }
      }
    } catch (err) {
      const msg =
        err instanceof ActionError
          ? err.message
          : 'Internal error during action execution';
      this.logger.error({ err, runId: run.id }, 'Action run threw exception');

      const isTerminalFailure = run.retry_count >= run.max_retries;
      try {
        await this.runRepo.markFailedOrRetry(run.id, msg, run);
      } catch (markErr) {
        this.logger.error(
          { err: markErr, runId: run.id },
          'Failed to mark run as failed',
        );
      }
      if (isTerminalFailure) {
        await this.writeAuditLog(run, actionFullName, null, msg);
        await this.advanceTemplate(run, null, true);
      }
    } finally {
      await ctx.releaseAllLocks();
    }
  }
}
