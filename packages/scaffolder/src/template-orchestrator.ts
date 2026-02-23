import type { Pool } from 'pg';
import type { Logger } from '@forgeportal/core';
import { ValidationError } from '@forgeportal/core';
import {
  renderTemplate,
  renderObjectDeep,
  buildStepContext,
  type StepOutputMap,
} from './template-engine.js';
import {
  validateUserInputs,
  type TemplateDefinition,
  type TemplateStep,
  type TemplateStepFile,
} from './template-parser.js';
import {
  TemplateRunRepository,
  type TemplateRun,
} from './template-run.repository.js';
import { ActionRunRepository } from './action-run.repository.js';
import type { ActionResult } from './types.js';

/** Resolve a Handlebars-boolean condition: renders the expression and checks for "true". */
function shouldRunStep(
  step: TemplateStep,
  context: Record<string, unknown>,
): boolean {
  if (!step.if) return true;
  return renderTemplate(step.if, context).trim() === 'true';
}

/**
 * Resolve skeleton files in a `files` array (used by scm.pushSkeleton@v1).
 * Items with `templatePath` are rendered from spec.skeletonFiles.
 * Items with `templateContent` are rendered inline.
 * Items with `contentBase64` are passed through unchanged.
 */
function resolveSkeletonFiles(
  files: TemplateStepFile[],
  skeletonFiles: Record<string, string>,
  context: Record<string, unknown>,
): Array<{ path: string; contentBase64: string }> {
  return files.map((file) => {
    if (file.templatePath) {
      const hbsTemplate = skeletonFiles[file.templatePath];
      if (!hbsTemplate) {
        throw new ValidationError(`Skeleton file not found: ${file.templatePath}`);
      }
      const rendered = renderTemplate(hbsTemplate, context);
      return { path: file.path, contentBase64: Buffer.from(rendered).toString('base64') };
    }
    if (file.templateContent) {
      const rendered = renderTemplate(file.templateContent, context);
      return { path: file.path, contentBase64: Buffer.from(rendered).toString('base64') };
    }
    return { path: file.path, contentBase64: file.contentBase64 ?? '' };
  });
}

/** Look up an action UUID by "name@version" string (e.g., "scm.createRepo@v1"). */
async function lookupActionId(pool: Pool, actionKey: string): Promise<string | null> {
  const atIdx = actionKey.lastIndexOf('@');
  if (atIdx === -1) return null;
  const name    = actionKey.slice(0, atIdx);
  const version = actionKey.slice(atIdx + 1);
  const result  = await pool.query<{ id: string }>(
    'SELECT id FROM actions WHERE name = $1 AND version = $2',
    [name, version],
  );
  return result.rows[0]?.id ?? null;
}

/** Load template definition from the `templates` table (stored as JSONB). */
async function loadTemplateDefinition(
  pool: Pool,
  templateId: string,
): Promise<TemplateDefinition | null> {
  const result = await pool.query<{ schema: TemplateDefinition }>(
    'SELECT schema FROM templates WHERE id = $1',
    [templateId],
  );
  if (result.rows.length === 0) return null;
  return result.rows[0]!.schema;
}

/**
 * Resolve a step's complete input, including:
 * 1. Handlebars interpolation of all string values in `step.input`
 * 2. Skeleton file resolution for `files` arrays containing `templatePath`
 */
function resolveStepInput(
  step: TemplateStep,
  context: Record<string, unknown>,
  skeletonFiles: Record<string, string>,
): Record<string, unknown> {
  const resolved = renderObjectDeep(step.input, context) as Record<string, unknown>;

  const rawFiles = step.input['files'];
  if (Array.isArray(rawFiles)) {
    resolved['files'] = resolveSkeletonFiles(
      rawFiles as TemplateStepFile[],
      skeletonFiles,
      context,
    );
  }

  return resolved;
}

export class TemplateOrchestrator {
  constructor(
    private readonly pool:            Pool,
    private readonly templateRunRepo: TemplateRunRepository,
    private readonly actionRunRepo:   ActionRunRepository,
    private readonly logger:          Logger,
  ) {}

  /**
   * Create a new template run and queue the first step's action_run.
   * Called by POST /api/v1/templates/run.
   */
  async startTemplateRun(
    templateId:  string,
    requestedBy: string,
    userInputs:  Record<string, unknown>,
  ): Promise<TemplateRun> {
    const definition = await loadTemplateDefinition(this.pool, templateId);
    if (!definition) {
      throw new ValidationError(`Template not found: ${templateId}`);
    }
    if (!definition.spec?.steps?.length) {
      throw new ValidationError(
        `Template "${templateId}" uses a legacy format that is not supported. ` +
        `Please ask your administrator to re-seed or migrate this template.`,
      );
    }

    validateUserInputs(definition.spec.parameters, userInputs);

    const templateRun = await this.templateRunRepo.create({
      template_id:  templateId,
      requested_by: requestedBy,
      user_inputs:  userInputs,
    });

    const firstStep  = definition.spec.steps[0]!;
    const context    = buildStepContext(userInputs, {});
    const skeletons  = definition.spec.skeletonFiles ?? {};
    const resolvedInput = resolveStepInput(firstStep, context, skeletons);

    const actionId = await lookupActionId(this.pool, firstStep.action);
    if (!actionId) {
      await this.templateRunRepo.markFailed(templateRun.id);
      throw new ValidationError(`Action not found in registry: ${firstStep.action}`);
    }

    await this.actionRunRepo.create({
      action_id:       actionId,
      template_run_id: templateRun.id,
      step_id:         firstStep.id,
      requested_by:    requestedBy,
      input:           resolvedInput,
    });

    this.logger.info(
      { templateRunId: templateRun.id, stepId: firstStep.id },
      'Template run started — first step queued',
    );

    return templateRun;
  }

  /**
   * Called by ActionRunner after each step reaches a terminal state.
   * - On failure: marks the template run as failed and stops.
   * - On success: saves step outputs, then queues the next step (or marks success).
   *
   * This method never throws — errors are logged so the runner's poll loop is never crashed.
   */
  async advanceTemplateRun(
    templateRunId:    string,
    completedStepId:  string,
    stepResult:       ActionResult | null,
    failed:           boolean,
  ): Promise<void> {
    if (failed) {
      await this.templateRunRepo.markFailed(templateRunId);
      this.logger.warn(
        { templateRunId, completedStepId },
        'Template run failed — no more steps will be queued',
      );
      return;
    }

    const outputs = stepResult?.outputs ?? {};
    await this.templateRunRepo.updateStepOutput(templateRunId, completedStepId, outputs);

    const templateRun = await this.templateRunRepo.getById(templateRunId);
    if (!templateRun) {
      this.logger.error({ templateRunId }, 'Template run not found during advance');
      return;
    }

    const definition = await loadTemplateDefinition(this.pool, templateRun.template_id);
    if (!definition) {
      this.logger.error(
        { templateRunId, templateId: templateRun.template_id },
        'Template definition not found during advance',
      );
      await this.templateRunRepo.markFailed(templateRunId);
      return;
    }

    const steps       = definition.spec.steps;
    const completedIdx = steps.findIndex((s) => s.id === completedStepId);
    if (completedIdx === -1) {
      this.logger.error(
        { templateRunId, completedStepId },
        'Completed step not found in template definition',
      );
      await this.templateRunRepo.markFailed(templateRunId);
      return;
    }

    const updatedStepOutputs: StepOutputMap = {
      ...templateRun.step_outputs,
      [completedStepId]: { outputs },
    };

    // Advance through steps, potentially skipping conditional steps
    let nextIdx = completedIdx + 1;
    const userInputs = templateRun.user_inputs;
    const skeletons  = definition.spec.skeletonFiles ?? {};

    while (nextIdx < steps.length) {
      const nextStep = steps[nextIdx]!;
      const context  = buildStepContext(userInputs, updatedStepOutputs);

      if (!shouldRunStep(nextStep, context)) {
        this.logger.info(
          { templateRunId, stepId: nextStep.id },
          'Template step skipped (if condition false)',
        );
        nextIdx++;
        continue;
      }

      const resolvedInput = resolveStepInput(nextStep, context, skeletons);
      const actionId = await lookupActionId(this.pool, nextStep.action);
      if (!actionId) {
        this.logger.error(
          { templateRunId, action: nextStep.action },
          'Action not found in registry — marking template run as failed',
        );
        await this.templateRunRepo.markFailed(templateRunId);
        return;
      }

      await this.actionRunRepo.create({
        action_id:       actionId,
        template_run_id: templateRunId,
        step_id:         nextStep.id,
        requested_by:    templateRun.requested_by,
        input:           resolvedInput,
      });

      this.logger.info(
        { templateRunId, stepId: nextStep.id },
        'Template run advanced — next step queued',
      );
      return;
    }

    // All steps completed (or all remaining steps were skipped)
    await this.templateRunRepo.markSuccess(templateRunId);
    this.logger.info({ templateRunId }, 'Template run completed successfully');
  }
}
