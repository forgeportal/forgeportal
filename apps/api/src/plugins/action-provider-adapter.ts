import type pg from 'pg';
import type { QueryResultRow } from 'pg';
import type { FastifyBaseLogger } from 'fastify';
import type {
  ActionProvider as SdkActionProvider,
  ActionContext as SdkActionContext,
  ActionResult as SdkActionResult,
} from '@forgeportal/plugin-sdk';
import type {
  ActionHandler,
  ActionContext as InternalActionContext,
  ActionResult as InternalActionResult,
} from '@forgeportal/scaffolder';
import type { SCMProviders } from '@forgeportal/scm';

/**
 * Parses a repository URL into owner/repo components.
 * Supports: https://github.com/owner/repo, git@github.com:owner/repo.git
 */
function parseRepoRef(repoUrl: string): { owner: string; repo: string } | null {
  const match = repoUrl.match(/[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/);
  if (!match) return null;
  return { owner: match[1]!, repo: match[2]! };
}

/**
 * Resolves which SCM provider to use based on the repository URL.
 */
function resolveScmProvider(scmProviders: SCMProviders, repoUrl: string) {
  if (repoUrl.includes('github.com')) return scmProviders.get('github');
  if (repoUrl.includes('gitlab')) return scmProviders.get('gitlab');
  // Fallback to first available provider
  return scmProviders.all()[0] ?? null;
}

/**
 * Adapts an SDK ActionProvider (plugin-authored) into an internal ActionHandler
 * (consumed by ActionRegistry and ActionRunner).
 *
 * The adapter:
 * - Bridges InternalActionContext → SdkActionContext (scoping SCM, DB, config)
 * - Restricts DB access to SELECT-only queries
 * - Scopes config to the plugin's config block
 */
export function adaptSdkActionProvider(
  provider:     SdkActionProvider,
  pluginConfig: Record<string, unknown>,
  scmProviders: SCMProviders,
  pool:         pg.Pool,
  logger:       FastifyBaseLogger,
): ActionHandler {
  return {
    actionId: `${provider.id}@${provider.version}`,

    async execute(ctx: InternalActionContext) {
      const sdkCtx: SdkActionContext = {
        config: {
          get: <T = unknown>(key: string): T | undefined =>
            pluginConfig[key] as T | undefined,
        },

        logger: {
          info:  (msg, meta) => logger.info(meta ?? {}, `[plugin] ${msg}`),
          warn:  (msg, meta) => logger.warn(meta ?? {}, `[plugin] ${msg}`),
          error: (msg, meta) => logger.error(meta ?? {}, `[plugin] ${msg}`),
        },

        scm: {
          async getFile(repoUrl, filePath, ref) {
            const scmRef = parseRepoRef(repoUrl);
            if (!scmRef) return null;
            const provider = resolveScmProvider(scmProviders, repoUrl);
            if (!provider) return null;
            try {
              const result = await provider.getFile(scmRef, filePath, ref ?? 'HEAD');
              return result?.content ?? null;
            } catch {
              return null;
            }
          },

          async *listFiles(repoUrl, prefix) {
            const scmRef = parseRepoRef(repoUrl);
            if (!scmRef) return;
            const provider = resolveScmProvider(scmProviders, repoUrl);
            if (!provider) return;
            try {
              const files = await provider.listFiles(scmRef, prefix ?? '');
              for (const f of files) yield f;
            } catch {
              // Swallow errors; yield nothing
            }
          },
        },

        db: {
          async query<T = Record<string, unknown>>(
            sql:     string,
            params?: unknown[],
          ): Promise<T[]> {
            const upperSql = sql.trim().toUpperCase();
            if (/^(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE)/.test(upperSql)) {
              throw new Error(
                '[ForgePortal SDK] Plugin DB access is read-only. Mutation queries are not allowed.',
              );
            }
            const result = await pool.query<QueryResultRow>(sql, params ?? []);
            return result.rows as unknown as T[];
          },
        },

        acquireRepoLock: (repoUrl) => ctx.acquireRepoLock(repoUrl),
        log:             (level, message) => ctx.log(level, message),
      };

      // Bridge SDK ActionResult → internal ActionResult.
      // SDK error is { code, message } while internal error is string.
      const sdkResult: SdkActionResult = await provider.handler(sdkCtx, ctx.input);
      const internalResult: InternalActionResult = {
        status:   sdkResult.status,
        outputs:  sdkResult.outputs,
        links:    sdkResult.links,
        warnings: sdkResult.warnings,
        error:    sdkResult.error
          ? `${sdkResult.error.code}: ${sdkResult.error.message}`
          : undefined,
      };
      return internalResult;
    },
  };
}
