import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { runMigrations } from '../migrate.js';

const { Pool } = pg;

const TEST_DB_CONFIG = {
  host: process.env['DB_HOST'] ?? 'localhost',
  port: Number(process.env['DB_PORT'] ?? 5433),
  database: 'forgeportal_test_migrations',
  user: process.env['DB_USER'] ?? 'forge',
  password: process.env['DB_PASSWORD'] ?? 'forge_local_dev',
};

let adminPool: pg.Pool;
let testPool: pg.Pool;

beforeAll(async () => {
  adminPool = new Pool({
    host: TEST_DB_CONFIG.host,
    port: TEST_DB_CONFIG.port,
    database: 'postgres',
    user: TEST_DB_CONFIG.user,
    password: TEST_DB_CONFIG.password,
  });

  await adminPool.query(
    `DROP DATABASE IF EXISTS ${TEST_DB_CONFIG.database}`,
  );
  await adminPool.query(`CREATE DATABASE ${TEST_DB_CONFIG.database}`);

  testPool = new Pool(TEST_DB_CONFIG);
});

afterAll(async () => {
  if (testPool) await testPool.end();
  if (adminPool) {
    await adminPool.query(
      `DROP DATABASE IF EXISTS ${TEST_DB_CONFIG.database}`,
    );
    await adminPool.end();
  }
});

beforeEach(async () => {
  await testPool.query('DROP SCHEMA public CASCADE');
  await testPool.query('CREATE SCHEMA public');
});

function createTempMigrationDir(
  files: Array<{ name: string; sql: string }>,
): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-mig-'));
  for (const f of files) {
    fs.writeFileSync(path.join(dir, f.name), f.sql, 'utf-8');
  }
  return dir;
}

describe('runMigrations', () => {
  it('applies migrations in alphabetical order on clean DB', async () => {
    const dir = createTempMigrationDir([
      {
        name: '001_users.sql',
        sql: 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT NOT NULL);',
      },
      {
        name: '002_posts.sql',
        sql: 'CREATE TABLE posts (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id), title TEXT);',
      },
    ]);

    await runMigrations(testPool, dir);

    const users = await testPool.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')`,
    );
    expect(users.rows[0].exists).toBe(true);

    const posts = await testPool.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'posts')`,
    );
    expect(posts.rows[0].exists).toBe(true);
  });

  it('re-running migrations is idempotent (no error, no duplicate entries)', async () => {
    const dir = createTempMigrationDir([
      {
        name: '001_users.sql',
        sql: 'CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT NOT NULL);',
      },
    ]);

    await runMigrations(testPool, dir);
    await runMigrations(testPool, dir);

    const result = await testPool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM _migrations',
    );
    expect(Number(result.rows[0].count)).toBe(1);
  });

  it('_migrations table tracks applied migrations correctly', async () => {
    const dir = createTempMigrationDir([
      {
        name: '001_alpha.sql',
        sql: 'CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY);',
      },
      {
        name: '002_beta.sql',
        sql: 'CREATE TABLE IF NOT EXISTS posts (id SERIAL PRIMARY KEY);',
      },
    ]);

    await runMigrations(testPool, dir);

    const result = await testPool.query<{ name: string }>(
      'SELECT name FROM _migrations ORDER BY id',
    );
    expect(result.rows.map((r) => r.name)).toEqual([
      '001_alpha.sql',
      '002_beta.sql',
    ]);
  });

  it('handles SQL files with BEGIN/COMMIT wrappers', async () => {
    const dir = createTempMigrationDir([
      {
        name: '001_wrapped.sql',
        sql: 'BEGIN;\nCREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT);\nCOMMIT;',
      },
    ]);

    await runMigrations(testPool, dir);

    const result = await testPool.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users')`,
    );
    expect(result.rows[0].exists).toBe(true);
  });
});
