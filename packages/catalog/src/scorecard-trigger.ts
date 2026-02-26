import crypto from 'node:crypto';
import type { Pool } from 'pg';
import { enqueueJob } from '@forgeportal/db';

/**
 * Enqueues `scorecard-eval` jobs for every active scorecard that applies to
 * the entity's kind.  Deduplication: if a job for the same (entityId, scorecardId)
 * pair is already queued or running, we skip it to avoid pile-ups.
 *
 * Returns the number of jobs actually enqueued.
 */
export async function enqueueScorecardEvalJobs(
  pool:     Pool,
  entityId: string,
  kind:     string,
  force     = false,
): Promise<number> {
  const scorecards = await pool.query<{ id: string }>(
    `SELECT id FROM scorecards WHERE applies_to_kind = $1 AND enabled = true`,
    [kind],
  );

  if (scorecards.rows.length === 0) return 0;

  let enqueued = 0;

  for (const sc of scorecards.rows) {
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM jobs
       WHERE type = 'scorecard-eval'
         AND status IN ('queued', 'running')
         AND payload->>'entityId'    = $1
         AND payload->>'scorecardId' = $2
       LIMIT 1`,
      [entityId, sc.id],
    );
    if (existing.rows.length > 0) continue;

    await enqueueJob(pool, 'scorecard-eval', {
      entityId,
      scorecardId: sc.id,
      force,
      _traceId: crypto.randomUUID(),
    });
    enqueued++;
  }

  return enqueued;
}
