/// <reference types="@fastify/secure-session" />
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import type { AppConfig } from '@forgeportal/core';
import { DEV_USER, type UserInfo } from './session.js';
import { resolveUserRole, type ResolvedIdentity } from './role-resolver.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: UserInfo;
    identity?: ResolvedIdentity;
  }
}

const SKIP_PATHS = new Set([
  '/healthz',
  '/livez',
  '/api/v1/auth/login',
  '/api/v1/auth/callback',
]);

const SKIP_PREFIXES = ['/api/v1/webhooks/'];

export function authGuard(config: AppConfig, pool: Pool) {
  const devMode = !config.auth.oidc.issuer;

  return async function guard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const path = request.url.split('?')[0];
    if (SKIP_PATHS.has(path)) return;
    if (SKIP_PREFIXES.some((p) => path.startsWith(p))) return;

    let user: UserInfo | undefined;

    if (devMode) {
      user = DEV_USER;
    } else {
      const sessionUser = request.session.get('user') as UserInfo | undefined;
      const exp = request.session.get('exp') as number | undefined;

      if (!sessionUser || !exp || exp < Math.floor(Date.now() / 1000)) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }
      user = sessionUser;
    }

    request.user = user;
    request.identity = await resolveUserRole(
      pool,
      user,
      devMode,
      config.auth.roleMapping,
    );
  };
}
