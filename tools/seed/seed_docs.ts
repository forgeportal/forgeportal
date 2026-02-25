#!/usr/bin/env tsx
/**
 * Docs seed script — inserts docs_bindings and docs_pages for all entities
 * currently in the DB so the Docs tab renders without a live SCM connection.
 *
 * Usage:
 *   pnpm seed:docs          # upsert bindings + pages (idempotent)
 *   pnpm seed:all           # seed:demo followed by seed:docs
 *
 * Environment variables (defaults match docker-compose dev setup):
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 */
import crypto from 'node:crypto';
import pg from 'pg';

// ── DB connection ──────────────────────────────────────────────────────────

const pool = new pg.Pool({
  host:     process.env['DB_HOST']     ?? 'localhost',
  port:     Number(process.env['DB_PORT'] ?? 5433),
  database: process.env['DB_NAME']     ?? 'forgeportal',
  user:     process.env['DB_USER']     ?? 'forge',
  password: process.env['DB_PASSWORD'] ?? 'forge_local_dev',
});

// ── Page templates ─────────────────────────────────────────────────────────

interface PageTemplate {
  path:    string;   // relative path — must start with docs_path + '/'
  title:   string;
  content: string;
}

function makePagesFor(entityName: string, kind: string): PageTemplate[] {
  return [
    {
      path:  'docs/README.md',
      title: entityName,
      content: [
        `# ${entityName}`,
        '',
        `**${entityName}** is a ${kind} maintained by the platform team.`,
        '',
        '## Overview',
        '',
        'This service handles core business logic. It is deployed on Kubernetes',
        'and exposed via an internal load balancer.',
        '',
        '## Quick Start',
        '',
        '```bash',
        `git clone https://github.com/acmecorp/${entityName}`,
        `cd ${entityName}`,
        'pnpm install && pnpm dev',
        '```',
        '',
        '## Links',
        '',
        '- [Runbook](docs/runbook.md)',
        '- [Architecture](docs/architecture.md)',
      ].join('\n'),
    },
    {
      path:  'docs/architecture.md',
      title: 'Architecture',
      content: [
        '# Architecture',
        '',
        `## Overview of ${entityName}`,
        '',
        'The service follows a layered architecture:',
        '',
        '- **API layer** — Fastify HTTP server, handles request validation.',
        '- **Service layer** — Business logic, orchestrates repositories.',
        '- **Repository layer** — PostgreSQL via `pg` pool, all queries here.',
        '',
        '## Data Flow',
        '',
        '```',
        'Client → API → Service → Repository → PostgreSQL',
        '```',
        '',
        '## Dependencies',
        '',
        '- PostgreSQL 16',
        '- Redis (optional cache layer)',
        '- Internal auth-service for token validation',
      ].join('\n'),
    },
    {
      path:  'docs/runbook.md',
      title: 'Runbook',
      content: [
        '# Runbook',
        '',
        `## ${entityName} — Operations Guide`,
        '',
        '## Health Checks',
        '',
        '```bash',
        `curl http://${entityName}:4000/healthz`,
        '```',
        '',
        '## Common Issues',
        '',
        '### Database connection refused',
        '',
        '1. Check that PostgreSQL is running: `pg_isready -h postgres`',
        '2. Verify `DB_HOST` env var is set correctly.',
        '3. Check connection pool exhaustion via `/metrics`.',
        '',
        '### High memory usage',
        '',
        '1. Check for N+1 queries — look for `SELECT` without `LIMIT`.',
        '2. Review heap snapshot using `node --heapsnapshot`.',
        '',
        '## On-call Escalation',
        '',
        'Page the platform team via PagerDuty if P0 issues persist > 15 min.',
      ].join('\n'),
    },
  ];
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();
  try {
    const entities = await client.query<{ id: string; name: string; kind: string }>(
      'SELECT id, name, kind FROM entities ORDER BY name',
    );

    if (entities.rows.length === 0) {
      console.log('⚠  No entities found in DB — run `pnpm seed:demo` first.');
      return;
    }

    let bindingCount = 0;
    let pageCount    = 0;

    for (const entity of entities.rows) {
      // Upsert docs_binding — docs_path = 'docs' so page paths 'docs/*' pass validation
      await client.query(
        `INSERT INTO docs_bindings (entity_id, repo_url, docs_path, last_indexed_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (entity_id) DO UPDATE
           SET repo_url        = EXCLUDED.repo_url,
               docs_path       = EXCLUDED.docs_path,
               last_indexed_at = now()`,
        [
          entity.id,
          `https://github.com/acmecorp/${entity.name}`,
          'docs',
        ],
      );
      bindingCount++;

      // Upsert docs_pages — 3 pages per entity
      const pages = makePagesFor(entity.name, entity.kind);
      for (const page of pages) {
        const hash = crypto.createHash('sha256').update(page.content).digest('hex');
        await client.query(
          `INSERT INTO docs_pages (id, entity_id, path, title, content_text, content_hash, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())
           ON CONFLICT (entity_id, path) DO UPDATE
             SET title        = EXCLUDED.title,
                 content_text = EXCLUDED.content_text,
                 content_hash = EXCLUDED.content_hash,
                 updated_at   = now()`,
          [crypto.randomUUID(), entity.id, page.path, page.title, page.content, hash],
        );
        pageCount++;
      }
    }

    console.log(
      `✅  Seeded ${bindingCount} docs bindings, ${pageCount} pages ` +
      `(${pages(pageCount / bindingCount)} per entity).`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

function pages(n: number): string {
  return Number.isFinite(n) ? `${Math.round(n)}` : '0';
}

main().catch((err) => {
  console.error('❌  Docs seed failed:', err);
  process.exit(1);
});
