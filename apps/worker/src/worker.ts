import crypto from 'node:crypto';
import http from 'node:http';
import { loadConfig, createLogger, metricsRegistry, actionRunQueueDepth, actionRunTotal } from '@forgeportal/core';
import { createPool, claimJob, completeJob, enqueueJob } from '@forgeportal/db';
import { createSCMProviders } from '@forgeportal/scm';
import {
  ActionRunner,
  ActionRegistry,
  ActionRunRepository,
  TemplateOrchestrator,
  TemplateRunRepository,
  CreateRepoHandler,
  CreateOrUpdateFileHandler,
  PushSkeletonHandler,
  OpenPrOrMrHandler,
  EnsureWebhookHandler,
  RegisterEntityHandler,
  DocsBootstrapHandler,
  CiBootstrapHandler,
  K8sBootstrapHandler,
  ScorecardsEvaluateHandler,
} from '@forgeportal/scaffolder';
import { ScorecardEngine } from '@forgeportal/scorecards';
import { createJobHandlers } from './handlers.js';

const config = loadConfig();
const logger = createLogger({ level: config.server.logLevel, name: 'worker' });
const pool = createPool(config.db);
const scmProviders = await createSCMProviders(config, logger);

const POLL_INTERVAL_MS = 5_000;
const WORKER_ID = `worker-${crypto.randomUUID().slice(0, 8)}`;
const METRICS_PORT = process.env['WORKER_METRICS_PORT']
  ? parseInt(process.env['WORKER_METRICS_PORT'], 10)
  : 9090;

logger.info({ workerId: WORKER_ID }, 'worker started');

// --- Prometheus metrics HTTP server (GET /metrics on METRICS_PORT) ---
const metricsServer = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/metrics') {
    try {
      const metrics = await metricsRegistry.metrics();
      res.writeHead(200, { 'Content-Type': metricsRegistry.contentType });
      res.end(metrics);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});
metricsServer.listen(METRICS_PORT, () => {
  logger.info({ port: METRICS_PORT }, 'Worker metrics server listening');
});

// Refresh action_run_queue_depth gauge every 15 s
const queueDepthTimer = setInterval(async () => {
  try {
    const { rows } = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM action_runs WHERE status = 'queued'`,
    );
    actionRunQueueDepth.set(parseInt(rows[0]?.count ?? '0', 10));
  } catch {
    // non-fatal
  }
}, 15_000);
queueDepthTimer.unref();

// Action runner loop (action_runs table — separate from jobs table)
const actionRegistry = new ActionRegistry();

// Register SCM action handlers
actionRegistry.register(new CreateRepoHandler(scmProviders));
actionRegistry.register(new CreateOrUpdateFileHandler(scmProviders));
actionRegistry.register(new PushSkeletonHandler(scmProviders));
actionRegistry.register(new OpenPrOrMrHandler(scmProviders));
actionRegistry.register(new EnsureWebhookHandler(scmProviders));

logger.info({ handlers: 5 }, 'SCM action handlers registered');

// Register platform action handlers
actionRegistry.register(new RegisterEntityHandler(pool));
actionRegistry.register(new DocsBootstrapHandler(pool, scmProviders));
actionRegistry.register(new CiBootstrapHandler(scmProviders));
actionRegistry.register(new K8sBootstrapHandler(scmProviders));
const scmProviderMap = new Map(
  (['github', 'gitlab'] as const)
    .filter((name) => scmProviders.get(name) !== null)
    .map((name) => [name, scmProviders.get(name)!] as const),
);
const scorecardEngine = new ScorecardEngine(pool, scmProviderMap);
actionRegistry.register(new ScorecardsEvaluateHandler(scorecardEngine));

logger.info({ handlers: 5 }, 'Platform action handlers registered');

const JOB_HANDLERS = createJobHandlers({ pool, scmProviders, config, logger, scorecardEngine });

const templateRunRepo = new TemplateRunRepository(pool);
const actionRunRepo   = new ActionRunRepository(pool);
const orchestrator    = new TemplateOrchestrator(pool, templateRunRepo, actionRunRepo, logger);

const actionRunner = new ActionRunner(pool, actionRegistry, scmProviders, logger, {
  concurrency:    5,
  pollIntervalMs: 1_000,
  orchestrator,
});

let running = true;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollJobs(): Promise<void> {
  while (running) {
    try {
      const job = await claimJob(pool, Object.keys(JOB_HANDLERS), WORKER_ID);
      if (job) {
        const handler = JOB_HANDLERS[job.type];
        if (handler) {
          try {
            await handler(job.payload);
            await completeJob(pool, job.id, 'success');
            actionRunTotal.inc({ status: 'success' });
          } catch (err) {
            logger.error({ err, jobId: job.id }, 'Job failed');
            await completeJob(pool, job.id, 'failed');
            actionRunTotal.inc({ status: 'failed' });
          }
        }
      } else {
        await sleep(POLL_INTERVAL_MS);
      }
    } catch (err) {
      logger.error({ err }, 'Error in job poll loop');
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

if (config.discovery.intervalMinutes > 0) {
  const intervalMs = config.discovery.intervalMinutes * 60_000;
  setInterval(async () => {
    try {
      await enqueueJob(pool, 'repo-scan', {});
      logger.info('Periodic repo-scan job enqueued');
    } catch (err) {
      logger.error({ err }, 'Failed to enqueue periodic repo-scan');
    }
  }, intervalMs);
}

const scorecardEvalIntervalHours = config.scorecards?.evalIntervalHours ?? 24;
if (scorecardEvalIntervalHours > 0) {
  const intervalMs = scorecardEvalIntervalHours * 60 * 60_000;

  async function enqueueBulkScorecardEval(): Promise<void> {
    try {
      const scorecards = await pool.query<{ id: string; applies_to_kind: string }>(
        `SELECT id, applies_to_kind FROM scorecards WHERE enabled = true`,
      );
      const entities = await pool.query<{ id: string; kind: string }>(
        `SELECT id, kind FROM entities`,
      );

      let enqueued = 0;
      for (const sc of scorecards.rows) {
        const matching = entities.rows.filter((e) => e.kind === sc.applies_to_kind);
        for (const entity of matching) {
          // Dedup: skip if a queued job already exists for this pair
          const existing = await pool.query<{ id: string }>(
            `SELECT id FROM jobs
             WHERE type = 'scorecard-eval'
               AND status = 'queued'
               AND payload->>'entityId' = $1
               AND payload->>'scorecardId' = $2
             LIMIT 1`,
            [entity.id, sc.id],
          );
          if (existing.rows.length === 0) {
            await enqueueJob(pool, 'scorecard-eval', {
              entityId:    entity.id,
              scorecardId: sc.id,
              force:       false,   // respect cache TTL for nightly sweeps
            });
            enqueued++;
          }
        }
      }
      logger.info(
        { enqueued, scorecards: scorecards.rowCount, entities: entities.rowCount },
        'Nightly scorecard-eval jobs enqueued',
      );
    } catch (err) {
      logger.error({ err }, 'Failed to enqueue nightly scorecard-eval jobs');
    }
  }

  // 5-minute startup delay to let the system stabilise, then every interval
  setTimeout(() => void enqueueBulkScorecardEval(), 5 * 60_000);
  setInterval(() => void enqueueBulkScorecardEval(), intervalMs);
}

async function shutdown(signal: string): Promise<void> {
  logger.info(`${signal} received, shutting down worker`);
  running = false;
  actionRunner.stop();
  metricsServer.close();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// Start both loops concurrently
void pollJobs();
void actionRunner.start();
