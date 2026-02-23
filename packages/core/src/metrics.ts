/**
 * Shared Prometheus metrics registry and custom metric declarations.
 *
 * Usage:
 *   - Call `initDefaultMetrics()` once at application startup (API or Worker).
 *   - Import individual metric objects to observe/increment them.
 *   - Expose `metricsRegistry.metrics()` on a GET /metrics route.
 */
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

export const metricsRegistry = new Registry();

/**
 * Register process_* and nodejs_* default metrics.
 * Call once during app bootstrap; safe to call multiple times (no-op after first).
 */
let _defaultMetricsInit = false;
export function initDefaultMetrics(): void {
  if (_defaultMetricsInit) return;
  _defaultMetricsInit = true;
  collectDefaultMetrics({ register: metricsRegistry });
}

// ---------------------------------------------------------------------------
// HTTP metrics (API)
// ---------------------------------------------------------------------------

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const httpErrorsTotal = new Counter({
  name: 'http_errors_total',
  help: 'Total HTTP error responses (4xx / 5xx)',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [metricsRegistry],
});

// ---------------------------------------------------------------------------
// Action run metrics (API + Worker)
// ---------------------------------------------------------------------------

export const actionRunQueueDepth = new Gauge({
  name: 'action_run_queue_depth',
  help: 'Number of action runs currently in queued status',
  registers: [metricsRegistry],
});

export const actionRunTotal = new Counter({
  name: 'action_run_total',
  help: 'Total action run completions',
  labelNames: ['status'] as const,
  registers: [metricsRegistry],
});

// ---------------------------------------------------------------------------
// Scan metrics (Worker / API scan routes)
// ---------------------------------------------------------------------------

export const scanDurationSeconds = new Histogram({
  name: 'scan_duration_seconds',
  help: 'Repository scan duration in seconds',
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [metricsRegistry],
});

// ---------------------------------------------------------------------------
// Scorecard metrics (Worker)
// ---------------------------------------------------------------------------

export const scorecardEvalSeconds = new Histogram({
  name: 'scorecard_evaluation_seconds',
  help: 'Scorecard evaluation duration in seconds',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [metricsRegistry],
});
