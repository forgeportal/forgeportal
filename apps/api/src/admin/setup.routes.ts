import type { FastifyInstance } from 'fastify';
import type { Pool } from 'pg';
import { z } from 'zod';
import { requirePermission } from '@forgeportal/auth';

export interface SetupRoutesOptions {
  pool: Pool;
}

const validateScmBody = z.object({
  provider: z.enum(['github', 'gitlab']),
  token:    z.string().min(1, 'Token is required'),
  org:      z.string().min(1, 'Organisation/group is required'),
  baseUrl:  z.string().url().optional(),
});

export async function setupRoutes(
  app: FastifyInstance,
  _opts: SetupRoutesOptions,
): Promise<void> {
  const guard = requirePermission('admin:settings');

  /**
   * POST /api/v1/admin/validate-scm
   * Tests a SCM token against the given org/group and returns the repo count.
   */
  app.post(
    '/api/v1/admin/validate-scm',
    { preHandler: [guard] },
    async (request, reply) => {
      const parsed = validateScmBody.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error:   'Bad Request',
          message: parsed.error.errors[0]?.message ?? 'Invalid body',
        });
      }

      const { provider, token, org, baseUrl } = parsed.data;

      try {
        if (provider === 'github') {
          const base = baseUrl?.replace(/\/$/, '') ?? 'https://api.github.com';
          const headers = {
            Authorization:        `Bearer ${token}`,
            Accept:               'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          };

          // Validate token + org existence
          const orgRes = await fetch(`${base}/orgs/${encodeURIComponent(org)}`, { headers });
          if (!orgRes.ok) {
            const msg =
              orgRes.status === 401 ? 'Invalid token — check your Personal Access Token.' :
              orgRes.status === 404 ? `Organisation "${org}" not found on GitHub.` :
              `GitHub API error ${orgRes.status}`;
            return reply.status(422).send({ ok: false, error: msg });
          }

          const orgData = await orgRes.json() as {
            public_repos?: number;
            total_private_repos?: number;
          };
          const repos = (orgData.public_repos ?? 0) + (orgData.total_private_repos ?? 0);
          return { ok: true, repos };

        } else {
          // GitLab
          const base = baseUrl?.replace(/\/$/, '') ?? 'https://gitlab.com';
          const headers = { 'PRIVATE-TOKEN': token };

          const groupRes = await fetch(
            `${base}/api/v4/groups/${encodeURIComponent(org)}?simple=true`,
            { headers },
          );
          if (!groupRes.ok) {
            const msg =
              groupRes.status === 401 ? 'Invalid token — check your Personal Access Token.' :
              groupRes.status === 404 ? `Group "${org}" not found on GitLab.` :
              `GitLab API error ${groupRes.status}`;
            return reply.status(422).send({ ok: false, error: msg });
          }

          // Count projects via a 1-item request and read x-total header
          const projRes = await fetch(
            `${base}/api/v4/groups/${encodeURIComponent(org)}/projects?per_page=1`,
            { headers },
          );
          const repos = projRes.ok
            ? parseInt(projRes.headers.get('x-total') ?? '0', 10) || 0
            : 0;
          return { ok: true, repos };
        }

      } catch (err) {
        return reply.status(502).send({
          ok:    false,
          error: `Network error: ${String(err)}`,
        });
      }
    },
  );
}
