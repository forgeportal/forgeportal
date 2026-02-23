import yaml from 'js-yaml';
import type { Pool } from 'pg';
import type { AppConfig, Logger } from '@forgeportal/core';
import type { SCMProviders, RepoRef } from '@forgeportal/scm';
import { enqueueJob } from '@forgeportal/db';
import { entityYamlSchema } from './entity-yaml.schema.js';
import { EntityRepository } from './entity.repository.js';
import { SourceRepository } from './source.repository.js';
import { upsertEntityFromYaml } from './scanner.js';

export interface WebhookEventOptions {
  provider: 'github' | 'gitlab';
  eventType: string;
  payload: Record<string, unknown>;
  pool: Pool;
  scmProviders: SCMProviders;
  config: AppConfig;
  logger: Logger;
}

export interface WebhookResult {
  action:                  'entity-refresh' | 'docs-index' | 'ignored' | 'ping';
  details?:                string;
  scorecardJobsEnqueued?:  number;
}

export function extractChangedFiles(
  payload: Record<string, unknown>,
): string[] {
  const commits =
    (payload['commits'] as Array<Record<string, unknown>>) ?? [];
  const files = new Set<string>();
  for (const commit of commits) {
    for (const f of (commit['added'] as string[]) ?? []) files.add(f);
    for (const f of (commit['modified'] as string[]) ?? []) files.add(f);
    for (const f of (commit['removed'] as string[]) ?? []) files.add(f);
  }
  return [...files];
}

export function extractRepoInfo(
  provider: 'github' | 'gitlab',
  payload: Record<string, unknown>,
): { ref: RepoRef; url: string; defaultBranch: string; fullName: string } {
  if (provider === 'github') {
    const repository = payload['repository'] as Record<string, unknown>;
    const fullName = repository['full_name'] as string;
    const [owner, repo] = fullName.split('/');
    return {
      ref: { owner, repo },
      url: repository['html_url'] as string,
      defaultBranch: (repository['default_branch'] as string) ?? 'main',
      fullName,
    };
  }
  const project = payload['project'] as Record<string, unknown>;
  const pathNs = project['path_with_namespace'] as string;
  const parts = pathNs.split('/');
  const repo = parts.pop()!;
  const owner = parts.join('/');
  return {
    ref: { owner, repo },
    url: project['web_url'] as string,
    defaultBranch: (project['default_branch'] as string) ?? 'main',
    fullName: pathNs,
  };
}

export async function handleWebhookEvent(
  opts: WebhookEventOptions,
): Promise<WebhookResult> {
  const { provider, eventType, payload, pool, scmProviders, config, logger } =
    opts;

  const isPing =
    eventType === 'ping' ||
    eventType === 'System Hook';
  if (isPing) return { action: 'ping' };

  const isPush =
    eventType === 'push' ||
    eventType === 'Push Hook';
  if (!isPush) {
    return { action: 'ignored', details: `Unhandled event type: ${eventType}` };
  }

  const changedFiles = extractChangedFiles(payload);
  if (changedFiles.length === 0) {
    return { action: 'ignored', details: 'No files changed' };
  }

  const entityFilePath = config.discovery.entityFilePath;
  const repoInfo = extractRepoInfo(provider, payload);

  const touchesEntity = changedFiles.some((f) => f === entityFilePath);
  const touchesDocs = changedFiles.some((f) => f.startsWith('docs/'));

  if (touchesEntity) {
    const scmProvider = scmProviders.get(provider);
    if (!scmProvider) {
      logger.warn(
        { provider },
        'SCM provider not available for entity refresh',
      );
      return { action: 'ignored', details: 'SCM provider not configured' };
    }

    const file = await scmProvider.getFile(repoInfo.ref, entityFilePath);
    if (!file) {
      logger.info(
        { repo: repoInfo.fullName },
        'entity.yaml removed — consider marking entity as deprecated',
      );
      return {
        action: 'entity-refresh',
        details: 'entity.yaml removed',
      };
    }

    let parsed: unknown;
    try {
      parsed = yaml.load(file.content);
    } catch {
      logger.warn({ repo: repoInfo.fullName }, 'Invalid YAML in entity file');
      return { action: 'ignored', details: 'Invalid YAML' };
    }

    const validated = entityYamlSchema.safeParse(parsed);
    if (!validated.success) {
      logger.warn(
        { repo: repoInfo.fullName, errors: validated.error.issues },
        'Entity YAML validation failed',
      );
      return { action: 'ignored', details: 'YAML validation failed' };
    }

    const entityRepo = new EntityRepository(pool);
    const sourceRepo = new SourceRepository(pool);

    const result = await upsertEntityFromYaml({
      yaml: validated.data,
      repoSummary: repoInfo,
      provider,
      entityFilePath,
      entityRepo,
      sourceRepo,
      pool,
      logger,
    });

    // Enqueue scorecard evaluations for all applicable scorecards (non-fatal)
    let scorecardJobsEnqueued = 0;
    try {
      const applicableScorecards = await pool.query<{ id: string }>(
        `SELECT id FROM scorecards WHERE applies_to_kind = $1 AND enabled = true`,
        [result.entityKind],
      );

      for (const sc of applicableScorecards.rows) {
        // Dedup: skip if a queued job already exists for this (entity, scorecard) pair
        const existing = await pool.query<{ id: string }>(
          `SELECT id FROM jobs
           WHERE type = 'scorecard-eval'
             AND status = 'queued'
             AND payload->>'entityId' = $1
             AND payload->>'scorecardId' = $2
           LIMIT 1`,
          [result.entityId, sc.id],
        );
        if (existing.rows.length === 0) {
          await enqueueJob(pool, 'scorecard-eval', {
            entityId:    result.entityId,
            scorecardId: sc.id,
            force:       true,  // entity just changed — bypass cache
          });
          scorecardJobsEnqueued++;
        }
      }
    } catch (err) {
      logger.warn({ err, entityId: result.entityId }, 'Failed to enqueue scorecard-eval jobs after entity refresh');
    }

    return {
      action:  'entity-refresh',
      details: `Entity ${result.action}: ${result.entityId}`,
      scorecardJobsEnqueued,
    };
  }

  if (touchesDocs) {
    const sourceResult = await pool.query<{ entity_id: string }>(
      'SELECT entity_id FROM entity_sources WHERE repo_url = $1 LIMIT 1',
      [repoInfo.url],
    );
    const entityId = sourceResult.rows[0]?.entity_id ?? null;

    if (!entityId) {
      logger.warn(
        { repoUrl: repoInfo.url },
        'docs-index: entity not found in entity_sources, skipping job',
      );
      return {
        action: 'ignored',
        details: `No entity found for repo URL: ${repoInfo.url}`,
      };
    }

    await enqueueJob(pool, 'docs-index', {
      entityId,
      repoUrl: repoInfo.url,
      changedPaths: changedFiles.filter((f) => f.startsWith('docs/')),
    });
    return {
      action: 'docs-index',
      details: `docs-index job enqueued for entity ${entityId}`,
    };
  }

  return { action: 'ignored', details: 'No relevant files changed' };
}
