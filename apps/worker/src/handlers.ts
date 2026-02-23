import type { Pool } from 'pg';
import type { Logger, AppConfig } from '@forgeportal/core';
import { scanDurationSeconds, scorecardEvalSeconds } from '@forgeportal/core';
import type { SCMProviders } from '@forgeportal/scm';
import type { ScorecardEngine } from '@forgeportal/scorecards';
import { runRepoScan } from '@forgeportal/catalog';
import { indexDocs } from '@forgeportal/docs';

export interface HandlerContext {
  pool:            Pool;
  scmProviders:    SCMProviders;
  config:          AppConfig;
  logger:          Logger;
  scorecardEngine: ScorecardEngine;
}

export function createJobHandlers(
  ctx: HandlerContext,
): Record<string, (payload: Record<string, unknown>) => Promise<void>> {
  const { pool, scmProviders, config, logger, scorecardEngine } = ctx;

  return {
    'repo-scan': async (payload) => {
      const scanStart = Date.now();
      const results = await runRepoScan({
        config,
        pool,
        scmProviders,
        logger,
        orgFilter: payload['org'] as string | undefined,
      });
      scanDurationSeconds.observe((Date.now() - scanStart) / 1000);
      logger.info({ results }, 'Repo scan completed');
    },

    'docs-index': async (payload) => {
      const { entityId, repoUrl, changedPaths } = payload as {
        entityId?: string;
        repoUrl?: string;
        changedPaths?: string[];
      };
      if (!entityId || !repoUrl) {
        logger.warn({ payload }, 'docs-index job missing entityId or repoUrl');
        return;
      }
      const result = await indexDocs({
        entityId,
        repoUrl,
        changedPaths,
        pool,
        scmProviders,
        logger,
        gitlabBaseUrl: config.scm?.gitlab?.baseUrl ?? undefined,
        maxIndexFileSizeBytes: config.docs?.maxIndexFileSizeBytes ?? undefined,
      });
      logger.info({ result }, 'docs-index completed');
    },

    'scorecard-eval': async (payload) => {
      const { entityId, scorecardId, force } = payload as {
        entityId?:    string;
        scorecardId?: string;
        force?:       boolean;
      };

      if (!entityId || !scorecardId) {
        logger.warn({ payload }, 'scorecard-eval: missing entityId or scorecardId');
        return;
      }

      const evalStart = Date.now();
      try {
        const result = await scorecardEngine.evaluate({
          entityId,
          scorecardId,
          force: force ?? false,
        });
        scorecardEvalSeconds.observe((Date.now() - evalStart) / 1000);

        logger.info(
          { entityId, scorecardId, level: result.level, status: result.status, cached: result.cached },
          'scorecard-eval completed',
        );
      } catch (err) {
        scorecardEvalSeconds.observe((Date.now() - evalStart) / 1000);
        // Re-throw so pollJobs() catches it and marks the job as 'failed'
        logger.error({ err, entityId, scorecardId }, 'scorecard-eval failed');
        throw err;
      }
    },
  };
}
