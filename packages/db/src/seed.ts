import fs from 'node:fs';
import type pg from 'pg';

export async function runSeed(pool: pg.Pool, seedFile: string): Promise<void> {
  const sql = fs.readFileSync(seedFile, 'utf-8');
  try {
    await pool.query(sql);
    console.log(`Seed applied: ${seedFile}`);
  } catch (err) {
    throw new Error(`Seed failed: ${seedFile} — ${String(err)}`);
  }
}
