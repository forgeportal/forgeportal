import type { Pool } from 'pg';
import type { UserInfo } from './session.js';
import {
  type Role,
  type Permission,
  ROLES,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
} from './rbac.js';

export interface PermissionScope {
  teams: string[];
  overrides: Permission[];
}

export interface ResolvedIdentity {
  sub: string;
  email: string;
  name: string;
  groups: string[];
  role: Role;
  scope: PermissionScope;
  permissions: Permission[];
}

/**
 * roleMapping: maps IDP group names → ForgePortal roles.
 * Defined in forgeportal.yaml (or via FORGEPORTAL_AUTH__ROLE_MAPPING__*).
 * If not set, the resolver expects IDP groups to exactly match ForgePortal role names.
 *
 * Example:
 *   auth:
 *     roleMapping:
 *       platform-admin: ["forge-admins", "ops-team"]
 *       developer:       ["engineers"]
 *       viewer:          ["all-staff"]
 */
export type RoleMapping = Partial<Record<Role, string[]>>;

function isValidRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

function highestRole(a: Role, b: Role): Role {
  return (ROLE_HIERARCHY[a] ?? 0) >= (ROLE_HIERARCHY[b] ?? 0) ? a : b;
}

/**
 * Derive the highest ForgePortal role from IDP groups.
 *
 * Two modes:
 *  1. With roleMapping (configured): translate IDP group names via the mapping.
 *  2. Without roleMapping (default): expect IDP groups to be exact ForgePortal role names.
 *     This is the zero-config path — Keycloak/Okta groups named "platform-admin" etc. work out of the box.
 */
function deriveRoleFromGroups(groups: string[], roleMapping?: RoleMapping): Role {
  // Highest-privilege roles checked first
  const orderedRoles: Role[] = [
    'platform-admin',
    'template-admin',
    'team-admin',
    'developer',
    'viewer',
  ];

  if (roleMapping && Object.keys(roleMapping).length > 0) {
    // Config-driven mapping: find the highest role whose IDP groups intersect with user groups
    for (const forgeRole of orderedRoles) {
      const idpGroups = roleMapping[forgeRole] ?? [];
      if (idpGroups.some((g) => groups.includes(g))) {
        return forgeRole;
      }
    }
    return 'viewer'; // default when roleMapping is set but no match
  }

  // Zero-config: IDP group names = ForgePortal role names
  for (const roleName of orderedRoles) {
    if (groups.includes(roleName)) return roleName;
  }
  return 'developer'; // default when no roleMapping and no matching group
}

export async function resolveUserRole(
  pool: Pool | null,
  user: UserInfo,
  devMode: boolean,
  roleMapping?: RoleMapping,
): Promise<ResolvedIdentity> {
  if (devMode) {
    return buildIdentity(user, 'platform-admin', { teams: [], overrides: [] });
  }

  // Start with role derived from IDP groups (using optional mapping)
  let role: Role = deriveRoleFromGroups(user.groups, roleMapping);
  const scope: PermissionScope = { teams: [], overrides: [] };

  if (pool) {
    // Override with explicit DB assignment (per-user or per-team)
    const userResult = await pool.query<{ role: string; scope: Record<string, unknown> }>(
      `SELECT role, scope FROM permissions WHERE subject_ref = $1 LIMIT 1`,
      [`user:${user.sub}`],
    );

    if (userResult.rows.length > 0) {
      const row = userResult.rows[0];
      if (isValidRole(row.role)) {
        role = row.role;
        if (Array.isArray(row.scope?.['teams'])) {
          scope.teams = row.scope['teams'] as string[];
        }
      }
    } else if (user.groups.length > 0) {
      const teamRefs = user.groups.map((g) => `team:${g}`);
      const placeholders = teamRefs.map((_, i) => `$${i + 1}`).join(', ');
      const teamResult = await pool.query<{ role: string; scope: Record<string, unknown> }>(
        `SELECT role, scope FROM permissions WHERE subject_ref IN (${placeholders})`,
        teamRefs,
      );

      for (const row of teamResult.rows) {
        if (isValidRole(row.role)) {
          role = highestRole(role, row.role);
          if (Array.isArray(row.scope?.['teams'])) {
            scope.teams.push(...(row.scope['teams'] as string[]));
          }
        }
      }

      scope.teams = [...new Set(scope.teams)];
    }
  }

  return buildIdentity(user, role, scope);
}

function buildIdentity(
  user: UserInfo,
  role: Role,
  scope: PermissionScope,
): ResolvedIdentity {
  const permSet = ROLE_PERMISSIONS[role];
  return {
    sub: user.sub,
    email: user.email,
    name: user.name,
    groups: user.groups,
    role,
    scope,
    permissions: [...permSet] as Permission[],
  };
}
