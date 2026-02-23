import fs from 'node:fs';
import path from 'node:path';
import type pg from 'pg';

const TRACKING_TABLE = '_migrations';

async function ensureTrackingTable(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TRACKING_TABLE} (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getAppliedMigrations(pool: pg.Pool): Promise<Set<string>> {
  const result = await pool.query<{ name: string }>(
    `SELECT name FROM ${TRACKING_TABLE} ORDER BY id`,
  );
  return new Set(result.rows.map((r) => r.name));
}

function hasSelfManagedTransaction(sql: string): boolean {
  return /^\s*BEGIN\s*;/i.test(sql);
}

function stripTransactionWrapper(sql: string): string {
  return sql
    .replace(/^\s*BEGIN\s*;\s*/im, '')
    .replace(/\s*COMMIT\s*;\s*$/im, '');
}

export async function runMigrations(
  pool: pg.Pool,
  migrationsDir: string,
): Promise<void> {
  await ensureTrackingTable(pool);
  const applied = await getAppliedMigrations(pool);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`Migration already applied: ${file} (skipping)`);
      continue;
    }

    const filePath = path.join(migrationsDir, file);
    const rawSql = fs.readFileSync(filePath, 'utf-8');

    const client = await pool.connect();
    try {
      const selfManaged = hasSelfManagedTransaction(rawSql);
      const sql = selfManaged ? stripTransactionWrapper(rawSql) : rawSql;

      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        `INSERT INTO ${TRACKING_TABLE} (name) VALUES ($1)`,
        [file],
      );
      await client.query('COMMIT');
      console.log(`Migration applied: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`Migration failed: ${file} — ${String(err)}`);
    } finally {
      client.release();
    }
  }
}
