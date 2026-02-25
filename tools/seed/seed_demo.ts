#!/usr/bin/env tsx
/**
 * Demo seed script — populates the catalog with realistic sample entities.
 *
 * Usage:
 *   pnpm seed:demo           # insert demo entities (idempotent)
 *   pnpm seed:reset          # truncate entities + re-seed
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
  password: process.env['DB_PASSWORD'] ?? 'forge',
});

// ── Demo entities ──────────────────────────────────────────────────────────

interface DemoEntity {
  name:        string;
  kind:        string;
  namespace?:  string;
  description: string;
  owner_ref:   string;
  lifecycle:   string;
  tags:        string[];
  links:       { title: string; url: string }[];
  scm?:        Record<string, unknown>;
}

const DEMO_ENTITIES: DemoEntity[] = [
  // ── Services (5) ──────────────────────────────────────────────────────────
  {
    name: 'auth-service',
    kind: 'service',
    description: 'Handles authentication, session management, and JWT issuance',
    owner_ref: 'team:platform',
    lifecycle: 'production',
    tags: ['auth', 'security', 'node', 'critical'],
    links: [
      { title: 'GitHub', url: 'https://github.com/acmecorp/auth-service' },
      { title: 'Runbook', url: 'https://wiki.acmecorp.internal/auth-runbook' },
    ],
    scm: { provider: 'github', owner: 'acmecorp', repo: 'auth-service' },
  },
  {
    name: 'payments-api',
    kind: 'service',
    description: 'Stripe integration, billing management, and invoice generation',
    owner_ref: 'team:billing',
    lifecycle: 'production',
    tags: ['payments', 'stripe', 'go', 'pci'],
    links: [
      { title: 'GitHub', url: 'https://github.com/acmecorp/payments-api' },
      { title: 'PCI DSS Docs', url: 'https://wiki.acmecorp.internal/pci' },
    ],
    scm: { provider: 'github', owner: 'acmecorp', repo: 'payments-api' },
  },
  {
    name: 'notification-service',
    kind: 'service',
    description: 'Email, SMS and push notification dispatch via SES and Twilio',
    owner_ref: 'team:platform',
    lifecycle: 'production',
    tags: ['notifications', 'email', 'sms', 'python'],
    links: [
      { title: 'GitHub', url: 'https://github.com/acmecorp/notification-service' },
    ],
    scm: { provider: 'github', owner: 'acmecorp', repo: 'notification-service' },
  },
  {
    name: 'recommendation-engine',
    kind: 'service',
    description: 'ML-powered product recommendation engine (experimental)',
    owner_ref: 'team:data',
    lifecycle: 'experimental',
    tags: ['ml', 'python', 'recommendation'],
    links: [
      { title: 'GitHub', url: 'https://github.com/acmecorp/recommendation-engine' },
      { title: 'ML Platform', url: 'https://mlflow.acmecorp.internal' },
    ],
    scm: { provider: 'github', owner: 'acmecorp', repo: 'recommendation-engine' },
  },
  {
    name: 'legacy-reports',
    kind: 'service',
    description: 'Deprecated Crystal Reports-based reporting service',
    owner_ref: 'team:finance',
    lifecycle: 'deprecated',
    tags: ['reports', 'legacy', 'java'],
    links: [
      { title: 'Migration Guide', url: 'https://wiki.acmecorp.internal/reports-migration' },
    ],
  },

  // ── Libraries (3) ─────────────────────────────────────────────────────────
  {
    name: 'acme-ui-kit',
    kind: 'library',
    description: 'Shared React component library — buttons, forms, data tables',
    owner_ref: 'team:frontend',
    lifecycle: 'production',
    tags: ['react', 'typescript', 'design-system', 'npm'],
    links: [
      { title: 'Storybook', url: 'https://storybook.acmecorp.internal' },
      { title: 'npm', url: 'https://www.npmjs.com/package/@acmecorp/ui-kit' },
    ],
    scm: { provider: 'github', owner: 'acmecorp', repo: 'acme-ui-kit' },
  },
  {
    name: 'acme-logger',
    kind: 'library',
    description: 'Structured logging library with OpenTelemetry trace correlation',
    owner_ref: 'team:platform',
    lifecycle: 'production',
    tags: ['logging', 'opentelemetry', 'node', 'npm'],
    links: [
      { title: 'GitHub', url: 'https://github.com/acmecorp/acme-logger' },
    ],
    scm: { provider: 'github', owner: 'acmecorp', repo: 'acme-logger' },
  },
  {
    name: 'acme-sdk',
    kind: 'library',
    description: 'Internal SDK for third-party integrations (Stripe, Twilio, Datadog)',
    owner_ref: 'team:platform',
    lifecycle: 'experimental',
    tags: ['sdk', 'integrations', 'typescript'],
    links: [
      { title: 'GitHub', url: 'https://github.com/acmecorp/acme-sdk' },
    ],
  },

  // ── Teams (2) ─────────────────────────────────────────────────────────────
  {
    name: 'platform',
    kind: 'group',
    description: 'Platform engineering team — infrastructure, tooling, developer experience',
    owner_ref: 'team:engineering',
    lifecycle: 'production',
    tags: ['team', 'platform', 'infra'],
    links: [
      { title: 'Team Wiki', url: 'https://wiki.acmecorp.internal/teams/platform' },
    ],
  },
  {
    name: 'billing',
    kind: 'group',
    description: 'Billing and payments squad owning all revenue-critical services',
    owner_ref: 'team:engineering',
    lifecycle: 'production',
    tags: ['team', 'billing', 'payments'],
    links: [
      { title: 'Team Wiki', url: 'https://wiki.acmecorp.internal/teams/billing' },
    ],
  },

  // ── System (1) ────────────────────────────────────────────────────────────
  {
    name: 'commerce-platform',
    kind: 'system',
    description: 'End-to-end e-commerce system: catalog, cart, checkout, payments, notifications',
    owner_ref: 'team:platform',
    lifecycle: 'production',
    tags: ['system', 'ecommerce'],
    links: [
      { title: 'Architecture Diagram', url: 'https://wiki.acmecorp.internal/arch/commerce' },
    ],
  },

  // ── Website (1) ───────────────────────────────────────────────────────────
  {
    name: 'frontend-app',
    kind: 'website',
    description: 'Main customer-facing React SPA served at app.acmecorp.com',
    owner_ref: 'team:frontend',
    lifecycle: 'production',
    tags: ['react', 'typescript', 'spa'],
    links: [
      { title: 'GitHub', url: 'https://github.com/acmecorp/frontend-app' },
      { title: 'Live', url: 'https://app.acmecorp.com' },
    ],
    scm: { provider: 'github', owner: 'acmecorp', repo: 'frontend-app' },
  },
];

// ── Main ───────────────────────────────────────────────────────────────────

const TRUNCATE = process.argv.includes('--reset');

async function main() {
  const client = await pool.connect();
  try {
    if (TRUNCATE) {
      console.log('⚠  Truncating entities table (CASCADE)…');
      await client.query('TRUNCATE entities CASCADE');
    }

    let inserted = 0;
    let skipped  = 0;

    for (const entity of DEMO_ENTITIES) {
      const result = await client.query(
        `INSERT INTO entities
           (id, kind, namespace, name, owner_ref, lifecycle, tags, links, scm, spec)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, '{}'::jsonb)
         ON CONFLICT (kind, namespace, name) DO NOTHING`,
        [
          crypto.randomUUID(),
          entity.kind,
          entity.namespace ?? 'default',
          entity.name,
          entity.owner_ref,
          entity.lifecycle,
          JSON.stringify(entity.tags ?? []),
          JSON.stringify(entity.links ?? []),
          JSON.stringify(entity.scm ?? {}),
        ],
      );
      if ((result.rowCount ?? 0) > 0) {
        inserted++;
      } else {
        skipped++;
      }
    }

    console.log(
      `✅  Seeded ${inserted} entities` +
      (skipped > 0 ? ` (${skipped} already existed, skipped)` : '') +
      '.',
    );
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌  Seed failed:', err);
  process.exit(1);
});
