import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegisterEntityHandler } from '../../../actions/platform/register-entity.handler.js';
import type { ActionContext } from '../../../types.js';

function makeCtx(input: Record<string, unknown> = {}): ActionContext {
  return {
    runId: 'run-1',
    entityId: null,
    requestedBy: 'user',
    input,
    acquireRepoLock: vi.fn().mockResolvedValue(undefined),
    log: vi.fn().mockResolvedValue(undefined),
  };
}

const ENTITY_ID = '00000000-0000-0000-0000-000000000001';

function makePool(upsertResult: { entity: { id: string }; created: boolean }) {
  // Mock the pool so EntityRepository and SourceRepository use it
  const upsertMock = vi.fn().mockResolvedValue({ rows: [{
    id: upsertResult.entity.id,
    kind: 'service',
    namespace: 'default',
    name: 'my-service',
    owner_ref: null,
    lifecycle: null,
    tags: [],
    links: [],
    scm: {},
    spec: {},
    created_at: new Date(),
    updated_at: new Date(),
    inserted: upsertResult.created,
  }]});
  const sourceMock = vi.fn().mockResolvedValue({ rows: [{ id: 'src-1', entity_id: ENTITY_ID }] });
  return {
    query: vi.fn().mockImplementation((sql: string) => {
      if (sql.includes('ON CONFLICT (kind, namespace, name)')) return upsertMock(sql);
      if (sql.includes('entity_sources')) return sourceMock(sql);
      return Promise.resolve({ rows: [] });
    }),
    upsertMock,
    sourceMock,
  };
}

const baseInput = {
  entity: {
    kind: 'service',
    name: 'my-service',
  },
};

describe('RegisterEntityHandler', () => {
  it('new entity → entityId returned, created=true, no warning', async () => {
    const pool = makePool({ entity: { id: ENTITY_ID }, created: true });
    const handler = new RegisterEntityHandler(pool as never);
    const ctx = makeCtx(baseInput);
    const result = await handler.execute(ctx);

    expect(result.status).toBe('success');
    expect(result.outputs.entityId).toBe(ENTITY_ID);
    expect(result.warnings).toHaveLength(0);
  });

  it('existing entity → entityId returned, warning added', async () => {
    const pool = makePool({ entity: { id: ENTITY_ID }, created: false });
    const handler = new RegisterEntityHandler(pool as never);
    const ctx = makeCtx(baseInput);
    const result = await handler.execute(ctx);

    expect(result.status).toBe('success');
    expect(result.outputs.entityId).toBe(ENTITY_ID);
    expect(result.warnings?.[0]).toContain('already existed');
  });

  it('with source → upsertSource called', async () => {
    const pool = makePool({ entity: { id: ENTITY_ID }, created: true });
    const handler = new RegisterEntityHandler(pool as never);
    const ctx = makeCtx({
      ...baseInput,
      source: {
        provider: 'github',
        repoUrl: 'https://github.com/acme/my-service',
        path: '/',
      },
    });
    await handler.execute(ctx);

    const sourceCallArgs = (pool.query as ReturnType<typeof vi.fn>).mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('entity_sources'),
    );
    expect(sourceCallArgs).toBeDefined();
  });

  it('missing required entity.name → VALIDATION_ERROR', async () => {
    const pool = makePool({ entity: { id: ENTITY_ID }, created: true });
    const handler = new RegisterEntityHandler(pool as never);
    const ctx = makeCtx({ entity: { kind: 'service' } });
    await expect(handler.execute(ctx)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('invalid entity.kind → VALIDATION_ERROR', async () => {
    const pool = makePool({ entity: { id: ENTITY_ID }, created: true });
    const handler = new RegisterEntityHandler(pool as never);
    const ctx = makeCtx({ entity: { kind: 'unknown-kind', name: 'x' } });
    await expect(handler.execute(ctx)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
