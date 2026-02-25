import { describe, it, expect } from 'vitest';
import { resolveFixAction } from '../fix-action-resolver.js';
import type { RuleDefinition, FixActionSuggestion } from '../types.js';
import type { EntityRow } from '@forgeportal/catalog';

// ── helpers ────────────────────────────────────────────────────────────────

function makeEntity(scm: Record<string, unknown> = {}): EntityRow {
  return {
    id:         'entity-1',
    kind:       'service',
    namespace:  'default',
    name:       'my-svc',
    owner_ref:  'team:backend',
    lifecycle:  'production',
    tags:       [],
    links:      [],
    annotations: {},
    scm,
    spec:       {},
    created_at: new Date(),
    updated_at: new Date(),
  };
}

const fullScm = { provider: 'github', owner: 'org', repo: 'my-repo', defaultBranch: 'main' };

function ruleOf(
  type: RuleDefinition['type'],
  params: RuleDefinition['params'],
  fixAction?: FixActionSuggestion,
): RuleDefinition {
  return { id: 'r1', title: 'Rule', level: 'Bronze', type, params, fixAction };
}

// ── tests ──────────────────────────────────────────────────────────────────

describe('resolveFixAction', () => {
  it('scm.file.exists README.md with SCM → returns scm.createOrUpdateFile@v1 with base64 content', () => {
    const rule = ruleOf('scm.file.exists', { path: 'README.md' });
    const result = resolveFixAction(rule, makeEntity(fullScm));

    expect(result).not.toBeNull();
    expect(result!.actionId).toBe('scm.createOrUpdateFile@v1');
    expect(result!.suggestedInputs['path']).toBe('README.md');
    // contentBase64 must be a non-empty base64 string
    const content = Buffer.from(result!.suggestedInputs['contentBase64'] as string, 'base64').toString();
    expect(content).toContain('Service');
  });

  it('scm.file.exists README.md without SCM owner/repo → returns null', () => {
    const rule = ruleOf('scm.file.exists', { path: 'README.md' });
    const result = resolveFixAction(rule, makeEntity({}));
    expect(result).toBeNull();
  });

  it('scm.anyOf with CI paths → returns ci.bootstrap@v1', () => {
    const rule = ruleOf('scm.anyOf', { paths: ['.github/workflows/ci.yml', '.gitlab-ci.yml'] });
    const result = resolveFixAction(rule, makeEntity(fullScm));

    expect(result).not.toBeNull();
    expect(result!.actionId).toBe('ci.bootstrap@v1');
    expect(result!.suggestedInputs['type']).toBe('github-actions');
  });

  it('scm.anyOf with docs paths → returns docs.bootstrap@v1', () => {
    const rule = ruleOf('scm.anyOf', { paths: ['docs/index.md', 'docs/README.md'] });
    const result = resolveFixAction(rule, makeEntity(fullScm));

    expect(result).not.toBeNull();
    expect(result!.actionId).toBe('docs.bootstrap@v1');
    expect(result!.suggestedInputs['docsPath']).toBe('docs');
    expect(result!.suggestedInputs['entityId']).toBe('entity-1');
  });

  it('scm.anyOf with unknown paths → returns null (no template)', () => {
    const rule = ruleOf('scm.anyOf', { paths: ['some/unknown/file.xyz'] });
    const result = resolveFixAction(rule, makeEntity(fullScm));
    expect(result).toBeNull();
  });

  it('entity.field.exists → always returns null', () => {
    const rule = ruleOf('entity.field.exists', { field: 'owner_ref' });
    const result = resolveFixAction(rule, makeEntity(fullScm));
    expect(result).toBeNull();
  });

  it('entity.link.exists → always returns null', () => {
    const rule = ruleOf('entity.link.exists', { titleContains: 'runbook' });
    const result = resolveFixAction(rule, makeEntity(fullScm));
    expect(result).toBeNull();
  });

  it('rule has explicit fixAction → returns it without modification (author priority)', () => {
    const explicit: FixActionSuggestion = {
      actionId: 'my-custom.action@v1',
      suggestedInputs: { foo: 'bar' },
    };
    const rule = ruleOf('scm.file.exists', { path: 'README.md' }, explicit);
    const result = resolveFixAction(rule, makeEntity(fullScm));

    expect(result).toBe(explicit);   // exact same reference — not recomputed
  });

  it('scm.file.exists CODEOWNERS → returns scm.createOrUpdateFile@v1 with CODEOWNERS template', () => {
    const rule = ruleOf('scm.file.exists', { path: 'CODEOWNERS' });
    const result = resolveFixAction(rule, makeEntity(fullScm));

    expect(result).not.toBeNull();
    expect(result!.actionId).toBe('scm.createOrUpdateFile@v1');
    const content = Buffer.from(result!.suggestedInputs['contentBase64'] as string, 'base64').toString();
    expect(content).toContain('CODEOWNERS');
  });

  it('scm.file.exists unknown-file.xyz → returns null (no template available)', () => {
    const rule = ruleOf('scm.file.exists', { path: 'unknown-file.xyz' });
    const result = resolveFixAction(rule, makeEntity(fullScm));
    expect(result).toBeNull();
  });
});
