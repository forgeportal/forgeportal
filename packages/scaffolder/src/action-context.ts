import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { Logger } from '@forgeportal/core';
import type { ActionContext } from './types.js';
import type { ActionRun } from './action-run.repository.js';
import type { ActionRunLogRepository } from './action-run-log.repository.js';

/**
 * Approximate PostgreSQL's hashtext() as a 32-bit signed integer.
 * Used to map a repo URL to a stable advisory lock key.
 */
function pgHashtext(s: string): number {
  const buf = createHash('sha256').update(s, 'utf8').digest();
  return buf.readInt32BE(0);
}

class ActionContextImpl implements ActionContext {
  readonly runId: string;
  readonly entityId: string | null;
  readonly requestedBy: string;
  readonly input: Record<string, unknown>;

  private readonly dedicatedClients: PoolClient[] = [];

  constructor(
    private readonly run: ActionRun,
    private readonly pool: Pool,
    private readonly logRepo: ActionRunLogRepository,
    private readonly logger: Logger,
  ) {
    this.runId = run.id;
    this.entityId = run.entity_id;
    this.requestedBy = run.requested_by;
    this.input = run.input;
  }

  async acquireRepoLock(repoUrl: string): Promise<void> {
    const lockId = pgHashtext(repoUrl);
    // Get a dedicated client — the lock is session-scoped to this connection.
    const client = await this.pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock($1::bigint)', [lockId]);
      this.dedicatedClients.push(client);
    } catch (err) {
      client.release();
      throw err;
    }
  }

  async releaseAllLocks(): Promise<void> {
    for (const client of this.dedicatedClients) {
      try {
        await client.query('SELECT pg_advisory_unlock_all()');
      } catch {
        // Best-effort release; log but do not throw
      } finally {
        client.release();
      }
    }
    this.dedicatedClients.length = 0;
  }

  async log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    meta?: Record<string, unknown>,
  ): Promise<void> {
    const payload = meta ? JSON.stringify({ message, ...meta }) : message;
    try {
      await this.logRepo.appendLog(this.runId, level, payload);
    } catch (err) {
      this.logger.warn({ err, runId: this.runId }, 'Failed to append action log');
    }
  }
}

export function createActionContext(
  run: ActionRun,
  pool: Pool,
  logRepo: ActionRunLogRepository,
  logger: Logger,
): ActionContextImpl {
  return new ActionContextImpl(run, pool, logRepo, logger);
}
