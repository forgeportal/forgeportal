import crypto from 'node:crypto';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import fastifySecureSession from '@fastify/secure-session';
import fastifyCsrfProtection from '@fastify/csrf-protection';
import type pg from 'pg';
import type { AppConfig } from '@forgeportal/core';
import {
  redactSecrets,
  initDefaultMetrics,
  metricsRegistry,
  httpRequestDuration,
  httpErrorsTotal,
  actionRunQueueDepth,
} from '@forgeportal/core';
import {
  authGuard,
  authRoutes,
  permissionsRoutes,
  type OIDCConfig,
  SESSION_MAX_AGE,
} from '@forgeportal/auth';
import { catalogRoutes, scanRoutes, webhookRoutes } from '@forgeportal/catalog';
import { configRoutes }       from './routes/config.routes.js';
import { integrationsRoutes } from './admin/integrations.routes.js';
import { statusRoutes } from './admin/status.routes.js';
import { setupRoutes } from './admin/setup.routes.js';
import { searchRoutes } from '@forgeportal/search';
import { docsRoutes } from '@forgeportal/docs';
import {
  actionRoutes,
  templateRoutes,
  TemplateOrchestrator,
  TemplateRunRepository,
  ActionRunRepository,
} from '@forgeportal/scaffolder';
import { scorecardRoutes } from '@forgeportal/scorecards';
import type { Logger } from '@forgeportal/core';
import type { SCMProviders } from '@forgeportal/scm';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    scmProviders: SCMProviders;
  }
  interface FastifyRequest {
    startTime: bigint;
  }
}

export function buildApp(
  pool: pg.Pool,
  config: AppConfig,
  oidcConfig?: OIDCConfig | null,
  scmProviders?: SCMProviders | null,
): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.server.logLevel,
      hooks: {
        logMethod(inputArgs, method) {
          const redactedArgs = inputArgs.map((arg) =>
            typeof arg === 'string' ? redactSecrets(arg) : arg,
          );
          return method.apply(this, redactedArgs as Parameters<typeof method>);
        },
      },
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            id: request.id,
          };
        },
        res(reply) {
          return { statusCode: reply.statusCode };
        },
        err(error) {
          return {
            type: error.name,
            message: redactSecrets(error.message),
            stack: redactSecrets(error.stack ?? ''),
          };
        },
      },
    },
    requestIdHeader: 'x-request-id',
    genReqId: (req) => {
      const h = req.headers['x-request-id'];
      return (Array.isArray(h) ? h[0] : h) ?? crypto.randomUUID();
    },
  });

  // --- Prometheus metrics bootstrap ---
  initDefaultMetrics();

  // Record start time for each request
  app.addHook('onRequest', (request, _reply, done) => {
    request.startTime = process.hrtime.bigint();
    done();
  });

  // Observe duration and count errors after each response
  app.addHook('onResponse', (request, reply, done) => {
    const durationNs = process.hrtime.bigint() - request.startTime;
    const durationSec = Number(durationNs) / 1e9;
    const route = (request.routeOptions?.url as string | undefined) ?? request.url.split('?')[0];
    const labels = {
      method: request.method,
      route,
      status_code: String(reply.statusCode),
    };
    httpRequestDuration.observe(labels, durationSec);
    if (reply.statusCode >= 400) {
      httpErrorsTotal.inc(labels);
    }
    done();
  });

  // Refresh queue depth gauge every 15 s
  const queueDepthTimer = setInterval(async () => {
    try {
      const { rows } = await pool.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM action_runs WHERE status = 'queued'`,
      );
      actionRunQueueDepth.set(parseInt(rows[0]?.count ?? '0', 10));
    } catch {
      // non-fatal — metric just won't update this cycle
    }
  }, 15_000);
  queueDepthTimer.unref();

  app.decorate('config', config);

  const defaultScmProviders: SCMProviders = {
    github: null, gitlab: null,
    all: () => [], get: () => null,
  };
  app.decorate('scmProviders', scmProviders ?? defaultScmProviders);

  // --- Cookie + Session ---
  const sessionKey = crypto.scryptSync(
    config.auth.sessionSecret,
    'forgeportal-salt',
    32,
  );

  app.register(fastifyCookie);
  app.register(fastifySecureSession, {
    key: sessionKey,
    cookieName: 'forgeportal.sid',
    cookie: {
      path: '/',
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'strict',
      maxAge: SESSION_MAX_AGE,
    },
  });

  // --- CSRF Protection ---
  app.register(fastifyCsrfProtection, {
    sessionPlugin: '@fastify/secure-session',
    cookieOpts: { signed: false, httpOnly: true, sameSite: 'strict' },
  });

  // --- Auth guard (runs before route handlers) ---
  app.addHook('onRequest', authGuard(config, pool));

  // --- CSRF verification for mutating requests ---
  const CSRF_SKIP_PREFIXES = ['/api/v1/auth/callback', '/api/v1/webhooks/'];
  const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  const devMode = !config.auth.oidc.issuer;

  app.addHook('onRequest', (request, reply, done) => {
    if (!CSRF_METHODS.has(request.method)) return done();
    if (devMode) return done();

    const path = request.url.split('?')[0];
    if (CSRF_SKIP_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return done();
    }

    app.csrfProtection(request, reply, done);
  });

  // --- Security headers (CSP, X-Content-Type-Options, Referrer-Policy, X-Frame-Options) ---
  const csp = config.server.securityHeaders?.csp ?? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'";
  app.addHook('onSend', (_request, reply, payload, done) => {
    if (csp) reply.header('Content-Security-Policy', csp);
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
    reply.header('X-Frame-Options', 'DENY');
    done(null, payload);
  });

  // --- Public config/branding route (no auth) ---
  app.register(configRoutes, { config });

  // --- Auth routes ---
  app.register(authRoutes, { config, oidcConfig: oidcConfig ?? null });

  // --- Admin permissions routes ---
  app.register(permissionsRoutes, { pool });

  // --- Admin integrations routes ---
  app.register(integrationsRoutes, { pool });

  // --- Admin setup wizard routes ---
  app.register(setupRoutes, { pool });

  // --- Admin status route (onboarding checklist) ---
  app.register(statusRoutes, { pool });

  // --- Catalog routes ---
  app.register(catalogRoutes, { pool });

  // --- Admin scan routes ---
  app.register(scanRoutes, { pool });

  // --- Webhook routes (encapsulated scope for raw body parser + rate limiter) ---
  app.register(webhookRoutes, { pool });

  // --- Search routes ---
  app.register(searchRoutes, { pool });

  // --- Docs routes ---
  app.register(docsRoutes, { pool });

  // --- Action runner routes ---
  app.register(actionRoutes, { pool });

  // --- Template routes ---
  app.register(templateRoutes, { pool });

  // --- Scorecard routes ---
  const templateRunRepo  = new TemplateRunRepository(pool);
  const actionRunRepo    = new ActionRunRepository(pool);
  const orchestrator     = new TemplateOrchestrator(pool, templateRunRepo, actionRunRepo, app.log as Logger);
  app.register(scorecardRoutes, { pool, templateRunner: orchestrator });

  // --- Correlation ID echo ---
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  app.addHook('onClose', async () => {
    await pool.end();
  });

  // --- Prometheus metrics route ---
  // Intentionally unauthenticated: the Prometheus pull model does not support
  // request-level auth in the default scrape configuration.
  // ⚠ Restrict this path to your internal network (security group, NetworkPolicy,
  //   or nginx `allow` directive) — do not expose it publicly in production.
  // See docs/deployment/docker-compose.md#observability--metrics for details.
  app.get('/metrics', async (_request, reply) => {
    reply.header('Content-Type', metricsRegistry.contentType);
    return metricsRegistry.metrics();
  });

  // --- Health routes ---
  app.get('/healthz', async (_req, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ok', db: 'connected' };
    } catch (err) {
      reply.status(503);
      return { status: 'degraded', db: 'disconnected', error: String(err) };
    }
  });

  app.get('/livez', async () => {
    return { status: 'ok' };
  });

  return app;
}
