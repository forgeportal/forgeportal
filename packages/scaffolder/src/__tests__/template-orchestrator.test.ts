import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateOrchestrator } from '../template-orchestrator.js';
import { TemplateRunRepository } from '../template-run.repository.js';
import { ActionRunRepository } from '../action-run.repository.js';
import { ValidationError } from '@forgeportal/core';
import type { Pool } from 'pg';

// --------------- helpers ---------------

function mockPool(overrides: Record<string, unknown> = {}): Pool {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    ...overrides,
  } as unknown as Pool;
}

const TEMPLATE_DEF = {
  apiVersion: 'forgeportal/v1',
  kind: 'Template',
  metadata: { name: 'test', title: 'Test', description: 'desc' },
  spec: {
    parameters: [
      { id: 'name', title: 'Name', type: 'string', required: true },
    ],
    steps: [
      { id: 'step-1', action: 'scm.createRepo@v1', input: { repo: '{{name}}' } },
      { id: 'step-2', action: 'ci.bootstrap@v1',   input: { repo: '{{name}}', type: 'github-actions' } },
    ],
    outputs: { repoUrl: '{{steps.step-1.outputs.repoUrl}}' },
    skeletonFiles: {
      'skeleton/README.md.hbs': '# {{name}}\n',
    },
  },
};

const BASE_TEMPLATE_RUN = {
  id:           'tr-1',
  template_id:  'tmpl-1',
  requested_by: 'user@example.com',
  status:       'running' as const,
  user_inputs:  { name: 'svc' },
  step_outputs: {},
  current_step: null,
  created_at:   new Date(),
  finished_at:  null,
};

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

// --------------- tests ---------------

describe('TemplateOrchestrator.startTemplateRun', () => {
  it('AC3 — creates template_run row and first action_run', async () => {
    const pool = mockPool({
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ schema: TEMPLATE_DEF }] })       // load template
        .mockResolvedValueOnce({ rows: [{ id: 'tr-1', template_id: 'tmpl-1', requested_by: 'user@example.com', status: 'running', user_inputs: { name: 'svc' }, step_outputs: {}, current_step: null, created_at: new Date(), finished_at: null }] }) // INSERT template_run
        .mockResolvedValueOnce({ rows: [{ id: 'action-uuid' }] })           // lookupActionId
        .mockResolvedValueOnce({ rows: [{ id: 'run-1', action_id: 'action-uuid', template_run_id: 'tr-1', step_id: 'step-1', requested_by: 'user@example.com', status: 'queued', input: {}, output: {}, locked_by: null, locked_at: null, retry_count: 0, max_retries: 3, idempotency_key: null, next_attempt_at: null, started_at: null, finished_at: null, created_at: new Date(), template_id: null }] }) // INSERT action_run
    });

    const templateRunRepo = new TemplateRunRepository(pool);
    const actionRunRepo   = new ActionRunRepository(pool);
    const orchestrator    = new TemplateOrchestrator(pool, templateRunRepo, actionRunRepo, makeLogger() as never);

    const run = await orchestrator.startTemplateRun('tmpl-1', 'user@example.com', { name: 'svc' });
    expect(run.id).toBe('tr-1');
    expect((pool.query as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('AC3 — invalid inputs throw ValidationError, no DB rows created', async () => {
    const pool = mockPool({
      query: vi.fn().mockResolvedValueOnce({ rows: [{ schema: TEMPLATE_DEF }] }),
    });
    const templateRunRepo = new TemplateRunRepository(pool);
    const actionRunRepo   = new ActionRunRepository(pool);
    const orchestrator    = new TemplateOrchestrator(pool, templateRunRepo, actionRunRepo, makeLogger() as never);

    await expect(
      orchestrator.startTemplateRun('tmpl-1', 'user@example.com', {}), // missing required 'name'
    ).rejects.toThrow(ValidationError);

    // Only the template load query should have been called
    expect((pool.query as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });
});

describe('TemplateOrchestrator.advanceTemplateRun', () => {
  let pool: Pool;
  let templateRunRepo: TemplateRunRepository;
  let actionRunRepo: ActionRunRepository;
  let orchestrator: TemplateOrchestrator;

  beforeEach(() => {
    pool = mockPool();
    templateRunRepo = new TemplateRunRepository(pool);
    actionRunRepo   = new ActionRunRepository(pool);
    orchestrator    = new TemplateOrchestrator(pool, templateRunRepo, actionRunRepo, makeLogger() as never);
  });

  it('AC7 — success: saves outputs, creates next action_run', async () => {
    const run = { ...BASE_TEMPLATE_RUN };
    const queryMock = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })                      // updateStepOutput
      .mockResolvedValueOnce({ rows: [run] })                                // getById
      .mockResolvedValueOnce({ rows: [{ schema: TEMPLATE_DEF }] })           // loadTemplateDefinition
      .mockResolvedValueOnce({ rows: [{ id: 'action-uuid-2' }] })            // lookupActionId step-2
      .mockResolvedValueOnce({ rows: [{ id: 'run-2', action_id: 'action-uuid-2', template_run_id: 'tr-1', step_id: 'step-2', requested_by: 'user@example.com', status: 'queued', input: {}, output: {}, locked_by: null, locked_at: null, retry_count: 0, max_retries: 3, idempotency_key: null, next_attempt_at: null, started_at: null, finished_at: null, created_at: new Date(), template_id: null }] }); // INSERT action_run

    (pool.query as ReturnType<typeof vi.fn>) = queryMock;

    await orchestrator.advanceTemplateRun(
      'tr-1', 'step-1',
      { status: 'success', outputs: { repoUrl: 'https://github.com/org/svc' }, links: [], warnings: [] },
      false,
    );

    expect(queryMock.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('AC7 — last step success marks template_run as success', async () => {
    const run = { ...BASE_TEMPLATE_RUN, step_outputs: { 'step-1': { outputs: { repoUrl: 'x' } } } };
    const queryMock = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })            // updateStepOutput
      .mockResolvedValueOnce({ rows: [run] })                      // getById
      .mockResolvedValueOnce({ rows: [{ schema: TEMPLATE_DEF }] }) // loadTemplateDefinition
      .mockResolvedValueOnce({ rows: [], rowCount: 1 });            // markSuccess

    (pool.query as ReturnType<typeof vi.fn>) = queryMock;

    await orchestrator.advanceTemplateRun(
      'tr-1', 'step-2',
      { status: 'success', outputs: {}, links: [], warnings: [] },
      false,
    );

    const markSuccessCall = queryMock.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes("status = 'success'"),
    );
    expect(markSuccessCall).toBeDefined();
  });

  it('AC8 — step failed marks template_run as failed, no more steps queued', async () => {
    const queryMock = vi.fn().mockResolvedValueOnce({ rows: [], rowCount: 1 }); // markFailed
    (pool.query as ReturnType<typeof vi.fn>) = queryMock;

    await orchestrator.advanceTemplateRun('tr-1', 'step-1', null, true);

    const markFailedCall = queryMock.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes("status = 'failed'"),
    );
    expect(markFailedCall).toBeDefined();
    // Only one DB call (markFailed) — no action_run created
    expect(queryMock.mock.calls.length).toBe(1);
  });

  it('AC7 — step with if=false is skipped, next step is queued', async () => {
    const defWithCondition = {
      ...TEMPLATE_DEF,
      spec: {
        ...TEMPLATE_DEF.spec,
        steps: [
          TEMPLATE_DEF.spec.steps[0]!,
          { id: 'skip-me', action: 'ci.bootstrap@v1', input: {}, if: "{{eq provider 'gitlab'}}" },
          { id: 'step-3', action: 'catalog.registerEntity@v1', input: {} },
        ],
      },
    };

    const run = { ...BASE_TEMPLATE_RUN, user_inputs: { name: 'svc', provider: 'github' } };
    const queryMock = vi.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })                   // updateStepOutput
      .mockResolvedValueOnce({ rows: [run] })                             // getById
      .mockResolvedValueOnce({ rows: [{ schema: defWithCondition }] })    // loadTemplateDefinition
      .mockResolvedValueOnce({ rows: [{ id: 'action-uuid-3' }] })         // lookupActionId step-3
      .mockResolvedValueOnce({ rows: [{ id: 'run-3', action_id: 'action-uuid-3', template_run_id: 'tr-1', step_id: 'step-3', requested_by: 'user@example.com', status: 'queued', input: {}, output: {}, locked_by: null, locked_at: null, retry_count: 0, max_retries: 3, idempotency_key: null, next_attempt_at: null, started_at: null, finished_at: null, created_at: new Date(), template_id: null }] }); // INSERT action_run

    (pool.query as ReturnType<typeof vi.fn>) = queryMock;

    await orchestrator.advanceTemplateRun(
      'tr-1', 'step-1',
      { status: 'success', outputs: {}, links: [], warnings: [] },
      false,
    );

    // The INSERT should target step-3, not skip-me
    const insertCall = queryMock.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO action_runs'),
    );
    expect(insertCall).toBeDefined();
    const insertParams = insertCall as unknown[];
    expect(insertParams[1]).toContain('step-3');
  });

  it('forge-fix-file — legacy flat format (no spec.steps) throws ValidationError with helpful message', async () => {
    const legacyDef = {
      apiVersion: 'forgeportal/v1',
      kind: 'Template',
      metadata: { name: 'forge-fix-file', title: 'Fix', description: 'fix' },
      // Bug: parameters and steps at root level, not inside spec
      parameters: [],
      steps: [{ id: 'create-file', action: 'scm.createOrUpdateFile@v1', input: {} }],
    };

    const pool = mockPool({
      query: vi.fn().mockResolvedValueOnce({ rows: [{ schema: legacyDef }] }),
    });
    const orchestrator = new TemplateOrchestrator(
      pool,
      new TemplateRunRepository(pool),
      new ActionRunRepository(pool),
      makeLogger() as never,
    );

    await expect(
      orchestrator.startTemplateRun('tmpl-fix', 'system', {}),
    ).rejects.toMatchObject({
      message: expect.stringContaining('legacy format'),
    });
  });

  it('forge-fix-file — correct spec format starts run and queues create-file step', async () => {
    const fixFileDef = {
      apiVersion: 'forgeportal/v1',
      kind: 'Template',
      metadata: {
        name: 'forge-fix-file',
        title: 'Fix: Create File + Open PR',
        description: 'Internal fix template',
        tags: [],
      },
      spec: {
        parameters: [],
        steps: [
          {
            id: 'create-file',
            action: 'scm.createOrUpdateFile@v1',
            input: {
              provider:      '{{provider}}',
              owner:         '{{owner}}',
              repo:          '{{repo}}',
              defaultBranch: '{{defaultBranch}}',
              path:          '{{path}}',
              contentBase64: '{{contentBase64}}',
              message:       '{{commitMessage}}',
              branch:        '{{branch}}',
            },
          },
          {
            id: 'open-pr',
            action: 'scm.openPrOrMr@v1',
            input: {
              provider:   '{{provider}}',
              owner:      '{{owner}}',
              repo:       '{{repo}}',
              headBranch: '{{branch}}',
              baseBranch: '{{defaultBranch}}',
              title:      '{{prTitle}}',
              body:       '{{prBody}}',
            },
          },
        ],
      },
    };

    const fixInputs = {
      provider:      'github',
      owner:         'acme',
      repo:          'my-service',
      branch:        'fix/add-readme',
      defaultBranch: 'main',
      path:          'README.md',
      contentBase64: Buffer.from('# my-service\n').toString('base64'),
      commitMessage: '[ForgePortal] Add README.md',
      prTitle:       '[ForgePortal] Add README.md',
      prBody:        'Automated fix from ForgePortal scorecard',
    };

    const fakeRun = {
      id: 'tr-fix-1', template_id: 'tmpl-fix',
      requested_by: 'system', status: 'running' as const,
      user_inputs: fixInputs, step_outputs: {},
      current_step: null, created_at: new Date(), finished_at: null,
    };

    const pool = mockPool({
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ schema: fixFileDef }] })       // loadTemplate
        .mockResolvedValueOnce({ rows: [fakeRun] })                       // INSERT template_run
        .mockResolvedValueOnce({ rows: [{ id: 'action-create-file' }] }) // lookupActionId create-file
        .mockResolvedValueOnce({ rows: [{ id: 'ar-1', action_id: 'action-create-file', template_run_id: 'tr-fix-1', step_id: 'create-file', requested_by: 'system', status: 'queued', input: {}, output: {}, locked_by: null, locked_at: null, retry_count: 0, max_retries: 3, idempotency_key: null, next_attempt_at: null, started_at: null, finished_at: null, created_at: new Date(), template_id: null }] }), // INSERT action_run
    });

    const orchestrator = new TemplateOrchestrator(
      pool,
      new TemplateRunRepository(pool),
      new ActionRunRepository(pool),
      makeLogger() as never,
    );

    const run = await orchestrator.startTemplateRun('tmpl-fix', 'system', fixInputs);
    expect(run.id).toBe('tr-fix-1');

    // Verify the action_run INSERT was called with the create-file step
    const calls = (pool.query as ReturnType<typeof vi.fn>).mock.calls;
    const insertCall = calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO action_runs'),
    );
    expect(insertCall).toBeDefined();
    // Inputs should have rendered {{provider}} → 'github', {{owner}} → 'acme', etc.
    const inputArg = JSON.stringify(insertCall![1]);
    expect(inputArg).toContain('github');
    expect(inputArg).toContain('acme');
    expect(inputArg).toContain('README.md');
  });

  it('AC6 — skeleton templatePath is resolved to contentBase64', async () => {
    const defWithSkeleton = {
      ...TEMPLATE_DEF,
      spec: {
        ...TEMPLATE_DEF.spec,
        steps: [
          {
            id: 'push',
            action: 'scm.pushSkeleton@v1',
            input: {
              repo: '{{name}}',
              files: [{ path: 'README.md', templatePath: 'skeleton/README.md.hbs' }],
            },
          },
        ],
        skeletonFiles: { 'skeleton/README.md.hbs': '# {{name}}\n' },
      },
    };

    const run = { ...BASE_TEMPLATE_RUN };
    const queryMock = vi.fn()
      .mockResolvedValueOnce({ rows: [{ schema: defWithSkeleton }] })   // load template
      .mockResolvedValueOnce({ rows: [run] })                           // INSERT template_run
      .mockResolvedValueOnce({ rows: [{ id: 'action-uuid' }] })         // lookupActionId
      .mockResolvedValueOnce({ rows: [{ id: 'ar-1', action_id: 'action-uuid', template_run_id: 'tr-1', step_id: 'push', requested_by: 'user@example.com', status: 'queued', input: {}, output: {}, locked_by: null, locked_at: null, retry_count: 0, max_retries: 3, idempotency_key: null, next_attempt_at: null, started_at: null, finished_at: null, created_at: new Date(), template_id: null }] }); // INSERT action_run

    (pool.query as ReturnType<typeof vi.fn>) = queryMock;

    await orchestrator.startTemplateRun('tmpl-1', 'user@example.com', { name: 'svc' });

    // Find the action_run INSERT call and check the input contains contentBase64
    const insertCall = queryMock.mock.calls.find(
      (c: unknown[]) => typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO action_runs'),
    );
    expect(insertCall).toBeDefined();
    const inputParam = JSON.stringify(insertCall![1]);
    expect(inputParam).toContain('contentBase64');

    const expectedB64 = Buffer.from('# svc\n').toString('base64');
    expect(inputParam).toContain(expectedB64);
  });
});
