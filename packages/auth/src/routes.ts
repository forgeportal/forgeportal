/// <reference types="@fastify/secure-session" />
/// <reference types="@fastify/csrf-protection" />
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '@forgeportal/core';
import {
  type OIDCConfig,
  configureOIDC,
  getAuthorizationUrl,
  handleCallback,
  extractUserInfo,
  randomPKCECodeVerifier,
  randomState,
} from './oidc.js';
import { SESSION_MAX_AGE, type UserInfo } from './session.js';

declare module '@fastify/secure-session' {
  interface SessionData {
    user: UserInfo;
    iat: number;
    exp: number;
    oidc_state: string;
    oidc_code_verifier: string;
  }
}

export interface AuthRoutesOptions {
  config: AppConfig;
  oidcConfig: OIDCConfig | null;
}

export async function authRoutes(
  app: FastifyInstance,
  opts: AuthRoutesOptions,
): Promise<void> {
  const { config } = opts;
  const devMode = !config.auth.oidc.issuer;

  // Mutable — allows lazy re-discovery if the IDP was unreachable at startup
  let oidcConfig: OIDCConfig | null = opts.oidcConfig;

  // Use configured redirect URI or auto-derive from server address
  const callbackUrl = config.auth.oidc.redirectUri ?? buildCallbackUrl(config);
  const scopes = config.auth.oidc.scopes;
  const groupsClaim = config.auth.oidc.groupsClaim;

  /**
   * Lazy OIDC discovery: if the IDP was unreachable at startup, retry on first login.
   * This makes the server resilient to temporary IDP unavailability during cold start.
   */
  async function ensureOIDC(): Promise<OIDCConfig | null> {
    if (oidcConfig) return oidcConfig;
    if (!config.auth.oidc.issuer) return null;
    try {
      oidcConfig = await configureOIDC(config.auth);
      app.log.info('OIDC lazy discovery completed');
    } catch (err) {
      app.log.error(
        { err },
        'OIDC lazy discovery failed — check OIDC_ISSUER and IDP connectivity',
      );
    }
    return oidcConfig;
  }

  // GET /api/v1/auth/login — initiates the OIDC Authorization Code + PKCE flow
  app.get('/api/v1/auth/login', async (request, reply) => {
    if (devMode) {
      return reply.status(501).send({
        error: 'Not Implemented',
        message: 'OIDC not configured — running in dev mode (set OIDC_ISSUER to enable)',
      });
    }

    const cfg = await ensureOIDC();
    if (!cfg) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message:
          'Identity provider unreachable. Check OIDC_ISSUER in your configuration and ensure the IDP is running.',
      });
    }

    const state = randomState();
    const codeVerifier = randomPKCECodeVerifier();

    request.session.set('oidc_state', state);
    request.session.set('oidc_code_verifier', codeVerifier);

    const { url } = await getAuthorizationUrl(cfg, callbackUrl, state, codeVerifier, scopes);
    return reply.redirect(url.href);
  });

  // GET /api/v1/auth/callback — handles IDP redirect, establishes session
  app.get('/api/v1/auth/callback', async (request, reply) => {
    if (devMode) {
      return reply.status(501).send({
        error: 'Not Implemented',
        message: 'OIDC not configured — running in dev mode',
      });
    }

    const cfg = await ensureOIDC();
    if (!cfg) {
      return reply.status(503).send({
        error: 'Service Unavailable',
        message: 'Identity provider unreachable during callback handling.',
      });
    }

    const state = request.session.get('oidc_state') as string | undefined;
    const codeVerifier = request.session.get('oidc_code_verifier') as string | undefined;

    if (!state || !codeVerifier) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Missing OIDC session state — please restart the login flow',
      });
    }

    // Build currentUrl from the configured callbackUrl (not from request host/port).
    // This ensures the redirect_uri in the token exchange exactly matches what was
    // sent to the IDP during authorization — even when the API is behind a proxy.
    const qs = new URL(request.url, 'http://localhost').search;
    const currentUrl = new URL(callbackUrl + qs);

    const { claims } = await handleCallback(cfg, currentUrl, state, codeVerifier);

    // extractUserInfo uses configurable groupsClaim (provider-agnostic)
    const userInfo = extractUserInfo(claims, groupsClaim);

    const now = Math.floor(Date.now() / 1000);
    request.session.set('user', userInfo);
    request.session.set('iat', now);
    request.session.set('exp', now + SESSION_MAX_AGE);
    request.session.set('oidc_state', undefined);
    request.session.set('oidc_code_verifier', undefined);

    return reply.redirect('/');
  });

  app.get('/api/v1/auth/me', async (request, reply) => {
    if (request.identity) {
      return { user: request.identity };
    }
    if (request.user) {
      return { user: request.user };
    }
    return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    request.session.delete();
    return reply.send({ success: true });
  });

  app.get('/api/v1/auth/csrf-token', async (request, reply) => {
    const token = reply.generateCsrf();
    return { token };
  });
}

function buildCallbackUrl(config: AppConfig): string {
  const proto = process.env['NODE_ENV'] === 'production' ? 'https' : 'http';
  const host = config.server.host === '0.0.0.0' ? 'localhost' : config.server.host;
  return `${proto}://${host}:${config.server.port}/api/v1/auth/callback`;
}
