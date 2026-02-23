import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import crypto from 'node:crypto';
import { requirePermission } from './require-permission.js';
import { ROLES, ROLE_PERMISSIONS, type Role } from './rbac.js';

export interface PermissionsRoutesOptions {
  pool: Pool;
}

export async function permissionsRoutes(
  app: FastifyInstance,
  opts: PermissionsRoutesOptions,
): Promise<void> {
  const { pool } = opts;
  const guard = requirePermission('admin:users');

  app.get('/api/v1/admin/permissions', {
    preHandler: [guard],
  }, async () => {
    const result = await pool.query(
      `SELECT id, subject_ref, role, scope, created_at FROM permissions ORDER BY created_at DESC`,
    );
    return { data: result.rows };
  });

  app.post('/api/v1/admin/permissions', {
    preHandler: [guard],
  }, async (request, reply) => {
    const body = request.body as {
      subjectRef?: string;
      role?: string;
      scope?: Record<string, unknown>;
    };

    if (!body.subjectRef || !body.role) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'subjectRef and role are required',
      });
    }

    if (!body.subjectRef.startsWith('user:') && !body.subjectRef.startsWith('team:')) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'subjectRef must start with user: or team:',
      });
    }

    if (!(ROLES as readonly string[]).includes(body.role)) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: `Invalid role. Must be one of: ${ROLES.join(', ')}`,
      });
    }

    const id = crypto.randomUUID();
    const scope = body.scope ?? {};

    const result = await pool.query(
      `INSERT INTO permissions (id, subject_ref, role, scope) VALUES ($1, $2, $3, $4) RETURNING id, subject_ref, role, scope, created_at`,
      [id, body.subjectRef, body.role, JSON.stringify(scope)],
    );

    return reply.status(201).send({ data: result.rows[0] });
  });

  app.delete('/api/v1/admin/permissions/:id', {
    preHandler: [guard],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await pool.query(`DELETE FROM permissions WHERE id = $1`, [id]);
    return reply.status(204).send();
  });

  app.get('/api/v1/admin/permissions/roles', {
    preHandler: [guard],
  }, async () => {
    const roles: Record<string, string[]> = {};
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      roles[role] = [...perms] as string[];
    }
    return { data: roles };
  });
}
