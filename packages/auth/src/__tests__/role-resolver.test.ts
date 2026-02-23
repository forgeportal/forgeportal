import { describe, it, expect, vi } from 'vitest';
import { resolveUserRole } from '../role-resolver.js';
import type { UserInfo } from '../session.js';

function makeUser(overrides?: Partial<UserInfo>): UserInfo {
  return {
    sub: 'u1',
    email: 'u@test.com',
    name: 'Test User',
    groups: [],
    ...overrides,
  };
}

function mockPool(rows: Record<string, unknown>[] = []) {
  return {
    query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
  } as never;
}

describe('resolveUserRole', () => {
  it('dev mode returns platform-admin without DB query', async () => {
    const pool = mockPool();
    const identity = await resolveUserRole(pool, makeUser(), true);
    expect(identity.role).toBe('platform-admin');
    expect(identity.permissions.length).toBeGreaterThan(0);
  });

  it('explicit user role in DB returns that role', async () => {
    const pool = mockPool([{ role: 'viewer', scope: {} }]);
    const identity = await resolveUserRole(pool, makeUser(), false);
    expect(identity.role).toBe('viewer');
  });

  it('team role in DB returns highest team role', async () => {
    const pool = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({
          rows: [
            { role: 'developer', scope: {} },
            { role: 'team-admin', scope: { teams: ['backend'] } },
          ],
          rowCount: 2,
        }),
    } as never;

    const identity = await resolveUserRole(pool, makeUser({ groups: ['backend', 'frontend'] }), false);
    expect(identity.role).toBe('team-admin');
    expect(identity.scope.teams).toContain('backend');
  });

  it('no DB entry + OIDC group platform-admin → platform-admin', async () => {
    const pool = mockPool();
    const identity = await resolveUserRole(pool, makeUser({ groups: ['platform-admin'] }), false);
    expect(identity.role).toBe('platform-admin');
  });

  it('no DB entry + no matching group → developer (default)', async () => {
    const pool = mockPool();
    const identity = await resolveUserRole(pool, makeUser({ groups: ['some-team'] }), false);
    expect(identity.role).toBe('developer');
  });
});
