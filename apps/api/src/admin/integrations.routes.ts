import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { requirePermission } from '@forgeportal/auth';
import { encrypt, decrypt } from '@forgeportal/core';
import type { AppConfig } from '@forgeportal/core';

export interface IntegrationsRoutesOptions {
  pool: Pool;
}

/** Secret field names per provider (stored encrypted, never returned in plain) */
const SECRET_FIELDS: Record<string, string[]> = {
  github: ['token', 'webhookSecret', 'privateKey'],
  gitlab: ['token', 'webhookSecret'],
};

const createBodySchema = z.object({
  provider: z.enum(['github', 'gitlab']),
  name: z.string().min(1).max(128),
  baseUrl: z.string().url().optional(),
  appId: z.string().max(255).optional(),
  /** Public config fields (non-secret) */
  config: z.record(z.string()).default({}),
  /** Secret fields — encrypted at rest, never returned */
  secrets: z.record(z.string()).default({}),
});

const updateBodySchema = createBodySchema.partial();

interface IntegrationRow {
  id: string;
  provider: string;
  name: string;
  base_url: string | null;
  app_id: string | null;
  secret_config: Record<string, string>;
  config: Record<string, string>;
  created_at: Date;
  updated_at: Date;
}

function safeRow(row: IntegrationRow, encryptionKey: string) {
  const secretFields = SECRET_FIELDS[row.provider] ?? [];
  const secretConfig = row.secret_config ?? {};
  const encryptedSecrets: Record<string, boolean> = {};
  for (const field of secretFields) {
    if (secretConfig[field]) encryptedSecrets[field] = true;
  }
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    baseUrl: row.base_url,
    appId: row.app_id,
    config: row.config ?? {},
    storedSecrets: encryptedSecrets,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function integrationsRoutes(
  app: FastifyInstance,
  opts: IntegrationsRoutesOptions,
): Promise<void> {
  const { pool } = opts;
  const config = (app as unknown as { config: AppConfig }).config;
  const encryptionKey = config.encryptionKey;
  const guard = requirePermission('admin:settings');

  /** GET /api/v1/admin/integrations — list, no secrets */
  app.get(
    '/api/v1/admin/integrations',
    { preHandler: [guard] },
    async () => {
      const result = await pool.query<IntegrationRow>(
        `SELECT id, provider, name, base_url, app_id, secret_config, config, created_at, updated_at
         FROM scm_integrations ORDER BY created_at DESC`,
      );
      return { data: result.rows.map((r) => safeRow(r, encryptionKey)) };
    },
  );

  /** POST /api/v1/admin/integrations — create */
  app.post(
    '/api/v1/admin/integrations',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = createBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.errors[0]?.message ?? 'Invalid body',
        });
      }
      const { provider, name, baseUrl, appId, config: pubConfig, secrets } = parsed.data;

      const secretFields = SECRET_FIELDS[provider] ?? [];
      const encryptedSecrets: Record<string, string> = {};
      for (const field of secretFields) {
        if (secrets[field]) {
          encryptedSecrets[field] = encrypt(secrets[field], encryptionKey);
        }
      }

      const id = crypto.randomUUID();
      const result = await pool.query<IntegrationRow>(
        `INSERT INTO scm_integrations (id, provider, name, base_url, app_id, config, secret_config)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, provider, name, base_url, app_id, secret_config, config, created_at, updated_at`,
        [id, provider, name, baseUrl ?? null, appId ?? null, JSON.stringify(pubConfig), JSON.stringify(encryptedSecrets)],
      );

      return reply.status(201).send({ data: safeRow(result.rows[0], encryptionKey) });
    },
  );

  /** PUT /api/v1/admin/integrations/:id — full or partial update */
  app.put(
    '/api/v1/admin/integrations/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = updateBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: parsed.error.errors[0]?.message ?? 'Invalid body',
        });
      }

      const existing = await pool.query<IntegrationRow>(
        `SELECT * FROM scm_integrations WHERE id = $1`,
        [id],
      );
      if (existing.rows.length === 0) {
        return reply.status(404).send({ error: 'NotFound', message: 'Integration not found' });
      }

      const row = existing.rows[0];
      const { provider, name, baseUrl, appId, config: pubConfig, secrets } = parsed.data;

      const effectiveProvider = provider ?? row.provider;
      const secretFields = SECRET_FIELDS[effectiveProvider] ?? [];
      const encryptedSecrets: Record<string, string> = { ...row.secret_config };

      if (secrets) {
        for (const field of secretFields) {
          if (secrets[field]) {
            encryptedSecrets[field] = encrypt(secrets[field], encryptionKey);
          } else if (secrets[field] === '') {
            delete encryptedSecrets[field];
          }
        }
      }

      const result = await pool.query<IntegrationRow>(
        `UPDATE scm_integrations
         SET provider = $2, name = $3, base_url = $4, app_id = $5,
             config = $6, secret_config = $7, updated_at = now()
         WHERE id = $1
         RETURNING id, provider, name, base_url, app_id, secret_config, config, created_at, updated_at`,
        [
          id,
          effectiveProvider,
          name ?? row.name,
          baseUrl !== undefined ? baseUrl ?? null : row.base_url,
          appId !== undefined ? appId ?? null : row.app_id,
          JSON.stringify(pubConfig ?? row.config ?? {}),
          JSON.stringify(encryptedSecrets),
        ],
      );

      return reply.send({ data: safeRow(result.rows[0], encryptionKey) });
    },
  );

  /** DELETE /api/v1/admin/integrations/:id */
  app.delete(
    '/api/v1/admin/integrations/:id',
    { preHandler: [guard] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await pool.query(
        `DELETE FROM scm_integrations WHERE id = $1`,
        [id],
      );
      if ((result.rowCount ?? 0) === 0) {
        return reply.status(404).send({ error: 'NotFound', message: 'Integration not found' });
      }
      return reply.status(204).send();
    },
  );
}
