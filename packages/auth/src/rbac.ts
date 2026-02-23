export const ROLES = [
  'platform-admin',
  'template-admin',
  'team-admin',
  'developer',
  'viewer',
] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  'entity:read',
  'entity:create',
  'entity:update',
  'entity:delete',
  'template:read',
  'template:create',
  'template:update',
  'template:delete',
  'action:read',
  'action:run',
  'template:run',
  'scorecard:read',
  'scorecard:create',
  'scorecard:update',
  'scorecard:delete',
  'scorecard:evaluate',
  'docs:read',
  'integration:read',
  'integration:manage',
  'admin:users',
  'admin:settings',
  'admin:plugins',
  'audit:read',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  'platform-admin': new Set(PERMISSIONS),
  'template-admin': new Set<Permission>([
    'entity:read', 'entity:create', 'entity:update',
    'template:read', 'template:create', 'template:update', 'template:delete', 'template:run',
    'action:read', 'action:run',
    'scorecard:read', 'scorecard:create', 'scorecard:update', 'scorecard:delete', 'scorecard:evaluate',
    'docs:read',
    'integration:read',
  ]),
  'team-admin': new Set<Permission>([
    'entity:read', 'entity:create', 'entity:update',
    'template:read', 'template:run',
    'action:read', 'action:run',
    'scorecard:read',
    'docs:read',
  ]),
  'developer': new Set<Permission>([
    'entity:read',
    'template:read', 'template:run',
    'action:read', 'action:run',
    'scorecard:read',
    'docs:read',
  ]),
  'viewer': new Set<Permission>([
    'entity:read',
    'template:read',
    'action:read',
    'scorecard:read',
    'docs:read',
  ]),
};

export const ROLE_HIERARCHY: Record<Role, number> = {
  'platform-admin': 100,
  'template-admin': 80,
  'team-admin': 60,
  'developer': 40,
  'viewer': 20,
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function isRoleAtLeast(userRole: Role, requiredRole: Role): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}
