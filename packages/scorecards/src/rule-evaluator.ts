import type { SCMProvider, RepoRef } from '@forgeportal/scm';
import type { EntityRow } from '@forgeportal/catalog';
import type {
  RuleDefinition,
  RuleResult,
  FieldExistsParams,
  LinkExistsParams,
  ScmFileExistsParams,
  ScmAnyOfParams,
} from './types.js';
import { ScmFileCache } from './scm-file-cache.js';

/** Internal context resolved from entity.scm metadata */
interface ScmContext {
  provider: SCMProvider;
  ref:      RepoRef;       // { owner, repo }
}

/**
 * Evaluates individual scorecard rules against an entity.
 * All SCM file checks are wrapped in try/catch — errors produce
 * `{ pass: false, error: msg }` rather than propagating (AC: 8).
 */
export class RuleEvaluator {
  constructor(
    private readonly scmProviders: Map<string, SCMProvider>,
    private readonly cache:        ScmFileCache,
  ) {}

  async evaluate(
    rule:   RuleDefinition,
    entity: EntityRow,
  ): Promise<RuleResult> {
    const base: Omit<RuleResult, 'pass' | 'details' | 'error'> = {
      ruleId:    rule.id,
      ruleTitle: rule.title,
      level:     rule.level,
    };

    try {
      switch (rule.type) {
        case 'entity.field.exists':
          return { ...base, ...this.evalFieldExists(rule.params as FieldExistsParams, entity) };
        case 'entity.link.exists':
          return { ...base, ...this.evalLinkExists(rule.params as LinkExistsParams, entity) };
        case 'scm.file.exists':
          return { ...base, ...await this.evalScmFileExists(rule.params as ScmFileExistsParams, entity) };
        case 'scm.anyOf':
          return { ...base, ...await this.evalScmAnyOf(rule.params as ScmAnyOfParams, entity) };
        default:
          return {
            ...base,
            pass:    false,
            details: {},
            error:   `Unknown rule type: ${(rule as RuleDefinition).type}`,
          };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ...base, pass: false, details: {}, error: msg };
    }
  }

  // ── entity.field.exists ────────────────────────────────────────────────────

  private evalFieldExists(
    params: FieldExistsParams,
    entity: EntityRow,
  ): Pick<RuleResult, 'pass' | 'details'> {
    const value = (entity as unknown as Record<string, unknown>)[params.field];
    const pass  =
      value != null &&
      value !== '' &&
      !(Array.isArray(value) && value.length === 0) &&
      !(typeof value === 'object' && !Array.isArray(value) && Object.keys(value as object).length === 0);
    return { pass, details: { field: params.field, value: String(value ?? 'null') } };
  }

  // ── entity.link.exists ─────────────────────────────────────────────────────

  private evalLinkExists(
    params: LinkExistsParams,
    entity: EntityRow,
  ): Pick<RuleResult, 'pass' | 'details'> {
    const links = (entity.links ?? []) as Array<{ title?: string; url?: string }>;
    const pass  = links.some((link) => {
      if (params.titleContains && !link.title?.toLowerCase().includes(params.titleContains.toLowerCase())) return false;
      if (params.urlContains   && !link.url?.toLowerCase().includes(params.urlContains.toLowerCase())) return false;
      if (params.urlStartsWith && !link.url?.toLowerCase().startsWith(params.urlStartsWith.toLowerCase())) return false;
      return true;
    });
    return { pass, details: { linksChecked: links.length, params } };
  }

  // ── scm.file.exists ────────────────────────────────────────────────────────

  private async evalScmFileExists(
    params: ScmFileExistsParams,
    entity: EntityRow,
  ): Promise<Pick<RuleResult, 'pass' | 'details'>> {
    const ctx = this.resolveScmContext(entity);
    if (!ctx) return { pass: false, details: { reason: 'no SCM source for entity' } };

    const { provider, ref } = ctx;
    const cached = this.cache.get(ref.owner, ref.repo, params.path);
    if (cached !== undefined) {
      return { pass: cached, details: { path: params.path, cached: true } };
    }

    const file   = await provider.getFile(ref, params.path).catch(() => null);
    const exists = file !== null;
    this.cache.set(ref.owner, ref.repo, params.path, exists);
    return { pass: exists, details: { path: params.path, cached: false } };
  }

  // ── scm.anyOf ──────────────────────────────────────────────────────────────

  private async evalScmAnyOf(
    params: ScmAnyOfParams,
    entity: EntityRow,
  ): Promise<Pick<RuleResult, 'pass' | 'details'>> {
    const ctx = this.resolveScmContext(entity);
    if (!ctx) return { pass: false, details: { reason: 'no SCM source for entity' } };

    const { provider, ref } = ctx;

    const results = await Promise.all(
      params.paths.map(async (path) => {
        const cached = this.cache.get(ref.owner, ref.repo, path);
        if (cached !== undefined) return { path, exists: cached };
        const file   = await provider.getFile(ref, path).catch(() => null);
        const exists = file !== null;
        this.cache.set(ref.owner, ref.repo, path, exists);
        return { path, exists };
      }),
    );

    const passedPath = results.find((r) => r.exists);
    return {
      pass:    passedPath !== undefined,
      details: { paths: params.paths, found: passedPath?.path ?? null },
    };
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private resolveScmContext(entity: EntityRow): ScmContext | null {
    const scm          = entity.scm as Record<string, unknown>;
    const providerName = (scm['provider'] as string | undefined)?.toLowerCase();
    const owner        = scm['owner'] as string | undefined;
    const repo         = scm['repo']  as string | undefined;

    if (!providerName || !owner || !repo) return null;

    const provider = this.scmProviders.get(providerName);
    if (!provider) return null;

    return { provider, ref: { owner, repo } };
  }
}
