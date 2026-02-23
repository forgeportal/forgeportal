import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Pool } from 'pg';
import type { AppConfig } from '@forgeportal/core';
import type { SCMProviders } from '@forgeportal/scm';
import { RateLimiter } from '@forgeportal/core';
import { handleWebhookEvent } from './webhook.handler.js';
import { EventDedup } from './webhook.dedup.js';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

export interface WebhookRoutesOptions {
  pool: Pool;
}

function detectProvider(
  request: FastifyRequest,
): 'github' | 'gitlab' | null {
  if (request.headers['x-hub-signature-256']) return 'github';
  if (request.headers['x-gitlab-token']) return 'gitlab';
  return null;
}

function extractEventType(
  request: FastifyRequest,
  provider: 'github' | 'gitlab',
): string {
  if (provider === 'github') {
    return (request.headers['x-github-event'] as string) ?? 'unknown';
  }
  return (request.headers['x-gitlab-event'] as string) ?? 'unknown';
}

function extractEventId(
  request: FastifyRequest,
  provider: 'github' | 'gitlab',
  payload: Record<string, unknown>,
): string {
  if (provider === 'github') {
    return (request.headers['x-github-delivery'] as string) ?? '';
  }
  const event = request.headers['x-gitlab-event'] as string ?? '';
  const project = payload['project'] as Record<string, unknown> | undefined;
  const projectId = project?.['id'] ?? '';
  const commits = (payload['commits'] as Array<Record<string, unknown>>) ?? [];
  const firstCommitId = commits[0]?.['id'] ?? '';
  if (!projectId && !firstCommitId) return '';
  return `${event}:${projectId}:${firstCommitId}`;
}

export async function webhookRoutes(
  app: FastifyInstance,
  opts: WebhookRoutesOptions,
): Promise<void> {
  const { pool } = opts;
  const config = (app as unknown as { config: AppConfig }).config;
  const scmProviders = (app as unknown as { scmProviders: SCMProviders })
    .scmProviders;

  const dedup = new EventDedup(1000);
  const rateLimiter = new RateLimiter(100, 60_000);
  const cleanupInterval = setInterval(() => rateLimiter.cleanup(), 60_000);
  app.addHook('onClose', () => clearInterval(cleanupInterval));

  app.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req: FastifyRequest, body: Buffer, done: (err: Error | null, result?: unknown) => void) => {
      (_req as FastifyRequest).rawBody = body;
      try {
        done(null, JSON.parse(body.toString()));
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  app.addHook(
    'preHandler',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const key = request.ip;
      if (!rateLimiter.isAllowed(key)) {
        const resetAt = rateLimiter.getResetAt(key);
        const retryAfterSec =
          resetAt != null
            ? Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
            : 60;
        return reply
          .header('Retry-After', String(retryAfterSec))
          .status(429)
          .send({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded: 100 req/min',
          });
      }
    },
  );

  app.post(
    '/api/v1/webhooks/scm',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const provider = detectProvider(request);
      if (!provider) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Missing webhook signature or token header',
        });
      }

      const payload = request.body as Record<string, unknown>;

      const eventId = extractEventId(request, provider, payload);
      if (eventId && dedup.isDuplicate(eventId)) {
        return { status: 'ok', action: 'duplicate', eventId };
      }

      const secret =
        provider === 'github'
          ? config.scm.github.webhookSecret
          : config.scm.gitlab.webhookSecret;

      if (!secret) {
        request.log.error(
          { provider },
          'Webhook secret not configured',
        );
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Webhook secret not configured',
        });
      }

      const signature =
        provider === 'github'
          ? (request.headers['x-hub-signature-256'] as string)
          : (request.headers['x-gitlab-token'] as string);

      const rawBody = request.rawBody;
      if (!rawBody) {
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Raw body not available',
        });
      }

      const scmProvider = scmProviders.get(provider);
      if (!scmProvider) {
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: `SCM provider ${provider} not configured`,
        });
      }

      const valid = scmProvider.verifyWebhookSignature(
        rawBody,
        signature,
        secret,
      );
      if (!valid) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid webhook signature',
        });
      }

      const eventType = extractEventType(request, provider);

      const result = await handleWebhookEvent({
        provider,
        eventType,
        payload,
        pool,
        scmProviders,
        config,
        logger: request.log as unknown as import('@forgeportal/core').Logger,
      });

      return { status: 'ok', ...result };
    },
  );
}
