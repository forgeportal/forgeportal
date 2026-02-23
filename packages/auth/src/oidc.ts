import * as oidc from 'openid-client';
import type { UserInfo } from './session.js';

export type OIDCConfig = oidc.Configuration;

export interface OIDCAuthOptions {
  oidc: {
    issuer?: string;
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    scopes?: string;
    groupsClaim?: string;
  };
}

export async function configureOIDC(auth: OIDCAuthOptions): Promise<OIDCConfig> {
  const { issuer, clientId, clientSecret } = auth.oidc;
  if (!issuer || !clientId) {
    throw new Error('OIDC issuer and clientId are required');
  }

  const issuerUrl = new URL(issuer);
  const isHttp = issuerUrl.protocol === 'http:';
  const isProd = process.env['NODE_ENV'] === 'production';

  if (isHttp && isProd) {
    throw new Error('OIDC issuer must use HTTPS in production');
  }

  // openid-client v6 enforces HTTPS by default; relax for local HTTP endpoints
  const executeMiddleware = isHttp ? [oidc.allowInsecureRequests] : undefined;

  return oidc.discovery(issuerUrl, clientId, clientSecret, undefined, {
    execute: executeMiddleware,
  });
}

export async function getAuthorizationUrl(
  config: OIDCConfig,
  callbackUrl: string,
  state: string,
  codeVerifier: string,
  scopes = 'openid email profile',
): Promise<{ url: URL; codeVerifier: string }> {
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const url = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: scopes,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });

  return { url, codeVerifier };
}

export async function handleCallback(
  config: OIDCConfig,
  currentUrl: URL,
  expectedState: string,
  codeVerifier: string,
): Promise<{ claims: Record<string, unknown> }> {
  const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
    pkceCodeVerifier: codeVerifier,
    expectedState,
  });

  const idClaims = tokens.claims();
  return { claims: (idClaims as Record<string, unknown>) ?? {} };
}

/**
 * Extract groups/roles from JWT claims.
 *
 * Resolution order (first non-empty wins):
 *  1. Explicit `groupsClaim` from config (e.g. "cognito:groups", "roles", "groups")
 *  2. Auto-detection: tries the most common claim paths across major IDPs:
 *     - "groups"                  (Keycloak, Okta, Auth0, Ping)
 *     - "roles"                   (Azure AD app roles, custom)
 *     - "realm_access.roles"      (Keycloak realm roles)
 *     - "resource_access.*.roles" (Keycloak client roles — flattened)
 */
export function extractGroups(
  claims: Record<string, unknown>,
  groupsClaim?: string,
): string[] {
  // 1. Explicit claim configured by the operator
  if (groupsClaim) {
    const value = getNestedClaim(claims, groupsClaim);
    if (Array.isArray(value)) return value.map(String);
    if (typeof value === 'string') return [value];
  }

  // 2. Auto-detect (covers most OIDC providers without any config)
  const candidates: unknown[] = [
    claims['groups'],
    claims['roles'],
    (claims['realm_access'] as Record<string, unknown> | undefined)?.['roles'],
    ...flattenResourceAccessRoles(claims),
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate.map(String);
    }
  }

  return [];
}

function getNestedClaim(
  claims: Record<string, unknown>,
  path: string,
): unknown {
  // Support dot notation: "realm_access.roles"
  const parts = path.split('.');
  let current: unknown = claims;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function flattenResourceAccessRoles(claims: Record<string, unknown>): unknown[][] {
  const resourceAccess = claims['resource_access'];
  if (!resourceAccess || typeof resourceAccess !== 'object') return [];

  return Object.values(resourceAccess as Record<string, unknown>).flatMap((client) => {
    const roles = (client as Record<string, unknown>)?.['roles'];
    return Array.isArray(roles) ? [roles] : [];
  });
}

export function extractUserInfo(
  claims: Record<string, unknown>,
  groupsClaim?: string,
): UserInfo {
  return {
    sub: String(claims['sub'] ?? ''),
    email: String(claims['email'] ?? ''),
    name: String(
      claims['name'] ?? claims['preferred_username'] ?? claims['email'] ?? '',
    ),
    groups: extractGroups(claims, groupsClaim),
  };
}

export function randomPKCECodeVerifier(): string {
  return oidc.randomPKCECodeVerifier();
}

export function randomState(): string {
  return oidc.randomState();
}
