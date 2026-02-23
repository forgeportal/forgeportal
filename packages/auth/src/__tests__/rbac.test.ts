import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  isRoleAtLeast,
  ROLE_PERMISSIONS,
  PERMISSIONS,
} from '../rbac.js';

describe('RBAC permission matrix', () => {
  it('platform-admin has all permissions', () => {
    for (const perm of PERMISSIONS) {
      expect(hasPermission('platform-admin', perm)).toBe(true);
    }
  });

  it('viewer has only read permissions', () => {
    const viewerPerms = ROLE_PERMISSIONS['viewer'];
    for (const perm of viewerPerms) {
      expect(perm).toMatch(/:read$/);
    }
  });

  it('viewer does NOT have action:run', () => {
    expect(hasPermission('viewer', 'action:run')).toBe(false);
  });

  it('developer HAS action:run', () => {
    expect(hasPermission('developer', 'action:run')).toBe(true);
  });

  it('team-admin has entity:update but NOT entity:delete', () => {
    expect(hasPermission('team-admin', 'entity:update')).toBe(true);
    expect(hasPermission('team-admin', 'entity:delete')).toBe(false);
  });

  it('template-admin has template:delete', () => {
    expect(hasPermission('template-admin', 'template:delete')).toBe(true);
  });

  it('developer does not have admin:users', () => {
    expect(hasPermission('developer', 'admin:users')).toBe(false);
  });
});

describe('Role hierarchy', () => {
  it('isRoleAtLeast(developer, viewer) → true', () => {
    expect(isRoleAtLeast('developer', 'viewer')).toBe(true);
  });

  it('isRoleAtLeast(viewer, developer) → false', () => {
    expect(isRoleAtLeast('viewer', 'developer')).toBe(false);
  });

  it('isRoleAtLeast(platform-admin, platform-admin) → true', () => {
    expect(isRoleAtLeast('platform-admin', 'platform-admin')).toBe(true);
  });
});
