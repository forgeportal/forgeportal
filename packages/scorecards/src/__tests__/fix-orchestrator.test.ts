import { describe, it, expect, vi } from 'vitest';
import { FixOrchestrator, FixNotAvailableError } from '../fix-orchestrator.js';
import type { ITemplateRunner } from '../types.js';
import type { EntityRow } from '@forgeportal/catalog';
import type { RuleDefinition } from '../types.js';

// ── fixtures ──────────────────────────────────────────────────────────────────

const TEMPLATE_ID   = 'tpl-1111-0000-0000-0000-000000000001';
const RUN_ID        = 'run-2222-0000-0000-0000-000000000001';

const entityGitHub: EntityRow = {
  id:         'ent-0001',
  kind:       'service',
  namespace:  'default',
  name:       'payment-svc',
  owner_ref:  'team:backend',
  lifecycle:  'production',
  tags:       [],
  links:      [],
  annotations: {},
  scm:        { provider: 'github', owner: 'acme', repo: 'payment', defaultBranch: 'main' },
  spec:       {},
  created_at: new Date(),
  updated_at: new Date(),
};

const entityGitLab: EntityRow = {
  ...entityGitHub,
  scm: { provider: 'gitlab', owner: 'acme', repo: 'payment', defaultBranch: 'main' },
};

const readmeRule: RuleDefinition = {
  id:    'readme',
  title: 'README.md exists',
  level: 'Bronze',
  type:  'scm.file.exists',
  params: { path: 'README.md' },
};

const ciRule: RuleDefinition = {
  id:    'ci',
  title: 'CI configured',
  level: 'Silver',
  type:  'scm.anyOf',
  params: { paths: ['.github/workflows/ci.yml', '.gitlab-ci.yml'] },
};

const docsRule: RuleDefinition = {
  id:    'docs',
  title: 'Docs homepage exists',
  level: 'Silver',
  type:  'scm.anyOf',
  params: { paths: ['docs/index.md', 'docs/index.rst'] },
};

const fieldRule: RuleDefinition = {
  id:    'owner',
  title: 'Owner is set',
  level: 'Bronze',
  type:  'entity.field.exists',
  params: { field: 'owner_ref' },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function makePool(templateId = TEMPLATE_ID) {
  return {
    query: vi.fn().mockResolvedValue({ rows: [{ id: templateId }], rowCount: 1 }),
    end:   vi.fn(),
  };
}

function makeTemplateRunner(runId = RUN_ID): ITemplateRunner {
  return {
    startTemplateRun: vi.fn().mockResolvedValue({ id: runId }),
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('FixOrchestrator.startFix', () => {
  it('scm.createOrUpdateFile@v1 fix → returns path + contentBase64 (AC: 1)', async () => {
    const pool     = makePool();
    const runner   = makeTemplateRunner();
    const orch     = new FixOrchestrator(pool as never, runner);

    const result   = await orch.startFix(entityGitHub, readmeRule, 'user@example.com');

    expect(result.templateRunId).toBe(RUN_ID);
    expect(result.statusUrl).toBe(`/api/v1/templates/runs/${RUN_ID}`);
    // Verify startTemplateRun was called with correct inputs
    const call = (runner.startTemplateRun as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, Record<string, unknown>];
    const inputs = call[2];
    expect(inputs['path']).toBe('README.md');
    expect(typeof inputs['contentBase64']).toBe('string');
  });

  it('ci.bootstrap@v1 fix (github) → generates GitHub Actions at .github/workflows/ci.yml (AC: 2)', async () => {
    const pool   = makePool();
    const runner = makeTemplateRunner();
    const orch   = new FixOrchestrator(pool as never, runner);

    await orch.startFix(entityGitHub, ciRule, 'user@example.com');

    const call   = (runner.startTemplateRun as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, Record<string, unknown>];
    const inputs = call[2];
    expect(inputs['path']).toBe('.github/workflows/ci.yml');
    const content = Buffer.from(inputs['contentBase64'] as string, 'base64').toString();
    expect(content).toContain('actions/checkout@v4');
  });

  it('ci.bootstrap@v1 fix (gitlab) → generates .gitlab-ci.yml (AC: 2)', async () => {
    const pool   = makePool();
    const runner = makeTemplateRunner();
    const orch   = new FixOrchestrator(pool as never, runner);

    await orch.startFix(entityGitLab, ciRule, 'user@example.com');

    const call   = (runner.startTemplateRun as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, Record<string, unknown>];
    const inputs = call[2];
    expect(inputs['path']).toBe('.gitlab-ci.yml');
    const content = Buffer.from(inputs['contentBase64'] as string, 'base64').toString();
    expect(content).toContain('image: node:20');
  });

  it('docs.bootstrap@v1 fix → generates docs/index.md stub (AC: 3)', async () => {
    const pool   = makePool();
    const runner = makeTemplateRunner();
    const orch   = new FixOrchestrator(pool as never, runner);

    await orch.startFix(entityGitHub, docsRule, 'user@example.com');

    const call   = (runner.startTemplateRun as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, Record<string, unknown>];
    const inputs = call[2];
    expect(inputs['path']).toBe('docs/index.md');
    const content = Buffer.from(inputs['contentBase64'] as string, 'base64').toString();
    expect(content).toContain('payment-svc Docs');
  });

  it('branch name matches forge/fix-<ruleId>-<base36> format (AC: 1)', async () => {
    const pool   = makePool();
    const runner = makeTemplateRunner();
    const orch   = new FixOrchestrator(pool as never, runner);

    const result = await orch.startFix(entityGitHub, readmeRule, 'user@example.com');

    expect(result.branch).toMatch(/^forge\/fix-readme-[a-z0-9]+$/);
    // Must be safe for URL / git
    expect(encodeURIComponent(result.branch)).toBe(result.branch.replace(/\//g, '%2F'));
  });

  it('prTitle equals [ForgePortal] Fix: <rule.title> (AC: 4)', async () => {
    const pool   = makePool();
    const runner = makeTemplateRunner();
    const orch   = new FixOrchestrator(pool as never, runner);

    const result = await orch.startFix(entityGitHub, readmeRule, 'user@example.com');

    expect(result.prTitle).toBe('[ForgePortal] Fix: README.md exists');
  });

  it('template not found in DB → throws Error', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      end:   vi.fn(),
    };
    const runner = makeTemplateRunner();
    const orch   = new FixOrchestrator(pool as never, runner);

    await expect(orch.startFix(entityGitHub, readmeRule, 'user@example.com'))
      .rejects.toThrow('Fix template "forge-fix-file" not found in DB');
  });

  it('entity.field.exists rule → throws FixNotAvailableError (AC: 7)', async () => {
    const pool   = makePool();
    const runner = makeTemplateRunner();
    const orch   = new FixOrchestrator(pool as never, runner);

    await expect(orch.startFix(entityGitHub, fieldRule, 'user@example.com'))
      .rejects.toThrow(FixNotAvailableError);
  });

  it('calls templateRunner.startTemplateRun with correct templateId and mergedInputs (AC: 9)', async () => {
    const pool   = makePool();
    const runner = makeTemplateRunner();
    const orch   = new FixOrchestrator(pool as never, runner);

    await orch.startFix(entityGitHub, readmeRule, 'dev@example.com');

    expect(runner.startTemplateRun).toHaveBeenCalledTimes(1);
    const [calledTemplateId, calledRequestedBy, calledInputs] =
      (runner.startTemplateRun as ReturnType<typeof vi.fn>).mock.calls[0] as [string, string, Record<string, unknown>];

    expect(calledTemplateId).toBe(TEMPLATE_ID);
    expect(calledRequestedBy).toBe('dev@example.com');
    expect(calledInputs['provider']).toBe('github');
    expect(calledInputs['owner']).toBe('acme');
    expect(calledInputs['repo']).toBe('payment');
    expect(calledInputs['prTitle']).toBe('[ForgePortal] Fix: README.md exists');
  });
});
