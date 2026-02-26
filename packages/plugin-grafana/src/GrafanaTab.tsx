import React, { useState, useMemo } from 'react';
import type { Entity } from '@forgeportal/plugin-sdk';

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeRange = '1h' | '6h' | '24h' | '7d';

interface TimeRangeOption {
  label: string;
  from:  string;
  to:    string;
}

const TIME_RANGES: Record<TimeRange, TimeRangeOption> = {
  '1h':  { label: '1h',  from: 'now-1h',  to: 'now' },
  '6h':  { label: '6h',  from: 'now-6h',  to: 'now' },
  '24h': { label: '24h', from: 'now-24h', to: 'now' },
  '7d':  { label: '7d',  from: 'now-7d',  to: 'now' },
};

// ─── URL builder ─────────────────────────────────────────────────────────────

function buildEmbedUrl(
  dashboardUrl: string,
  opts: { from: string; to: string; varName?: string; varValue?: string },
): string {
  try {
    const url = new URL(dashboardUrl);
    url.searchParams.set('from',  opts.from);
    url.searchParams.set('to',    opts.to);
    url.searchParams.set('kiosk', '1');
    url.searchParams.set('theme', 'light');
    if (opts.varName && opts.varValue) {
      url.searchParams.set(`var-${opts.varName}`, opts.varValue);
    }
    return url.toString();
  } catch {
    return dashboardUrl;
  }
}

function buildOpenUrl(dashboardUrl: string): string {
  try {
    const url = new URL(dashboardUrl);
    // Remove kiosk param for the "open in Grafana" link
    url.searchParams.delete('kiosk');
    return url.toString();
  } catch {
    return dashboardUrl;
  }
}

/**
 * Parses a comma-separated (or newline-separated) list of dashboard URLs
 * from the annotation value.
 */
function parseDashboardUrls(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter((s) => {
      try { new URL(s); return true; } catch { return false; }
    });
}

function dashboardLabel(url: string, index: number): string {
  try {
    const u = new URL(url);
    // Extract the dashboard slug from the path: /d/<uid>/<slug>
    const parts = u.pathname.split('/').filter(Boolean);
    const slugIdx = parts.findIndex((p) => p === 'd') + 2;
    const slug = parts[slugIdx];
    if (slug) return slug.replace(/-/g, ' ');
  } catch { /* fall through */ }
  return `Dashboard ${index + 1}`;
}

// ─── Main Tab ────────────────────────────────────────────────────────────────

interface GrafanaTabProps { entity: Entity }

export function GrafanaTab({ entity }: GrafanaTabProps): React.ReactElement {
  const [timeRange,    setTimeRange]    = useState<TimeRange>('6h');
  const [activeDashId, setActiveDashId] = useState(0);

  const annotations  = entity.annotations ?? {};
  const rawUrls      = annotations['forgeportal.dev/grafana-dashboard-url'] ?? '';
  const varName      = annotations['forgeportal.dev/grafana-variable-name'];
  const varValue     = entity.name;

  const dashboards = useMemo(() => parseDashboardUrls(rawUrls), [rawUrls]);

  // Not configured state
  if (dashboards.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
        <p className="text-sm font-medium text-gray-700 mb-1">No Grafana dashboard configured</p>
        <p className="text-xs text-gray-500 mb-4">
          Add the annotation{' '}
          <code className="rounded bg-gray-100 px-1 py-0.5">forgeportal.dev/grafana-dashboard-url</code>{' '}
          to your <code className="rounded bg-gray-100 px-1 py-0.5">entity.yaml</code>.
        </p>
        <pre className="mx-auto max-w-lg rounded bg-gray-800 p-3 text-left text-xs text-green-300">
          {`metadata:\n  annotations:\n    forgeportal.dev/grafana-dashboard-url: https://grafana.internal/d/abc123/service-overview\n    forgeportal.dev/grafana-variable-name: service  # optional`}
        </pre>
      </div>
    );
  }

  const activeDash    = dashboards[activeDashId] ?? dashboards[0]!;
  const { from, to }  = TIME_RANGES[timeRange];
  const embedUrl      = buildEmbedUrl(activeDash, { from, to, varName, varValue });
  const openUrl       = buildOpenUrl(activeDash);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Multi-dashboard tab strip */}
        {dashboards.length > 1 && (
          <div className="flex gap-1 border border-gray-200 rounded-md p-0.5 bg-gray-50">
            {dashboards.map((url, i) => (
              <button
                key={i}
                onClick={() => setActiveDashId(i)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  activeDashId === i
                    ? 'bg-white shadow-sm text-gray-800'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {dashboardLabel(url, i)}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          {/* Time range selector */}
          <div className="flex items-center gap-0.5 rounded-md border border-gray-200 bg-gray-50 p-0.5">
            {(Object.keys(TIME_RANGES) as TimeRange[]).map((tr) => (
              <button
                key={tr}
                onClick={() => setTimeRange(tr)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                  timeRange === tr
                    ? 'bg-white shadow-sm text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {TIME_RANGES[tr].label}
              </button>
            ))}
          </div>

          {/* Open in Grafana */}
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open in Grafana
          </a>
        </div>
      </div>

      {/* Variable info badge */}
      {varName && (
        <p className="text-xs text-gray-400">
          Variable injection: <code className="rounded bg-gray-100 px-1">var-{varName}={varValue}</code>
        </p>
      )}

      {/* Embedded dashboard iframe */}
      <div className="relative w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
           style={{ paddingBottom: '56.25%' /* 16:9 */ }}>
        <iframe
          key={`${embedUrl}`}
          src={embedUrl}
          className="absolute inset-0 h-full w-full"
          title={`Grafana — ${dashboardLabel(activeDash, activeDashId)}`}
          frameBorder="0"
          allowFullScreen
        />

        {/* Overlay shown while iframe may be blocked by CSP */}
        <noscript>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-center p-6">
            <p className="text-sm font-medium text-gray-700 mb-2">Dashboard cannot be embedded</p>
            <p className="text-xs text-gray-500 mb-4">
              Your Grafana instance may require authentication or have CSP restrictions.
            </p>
            <a
              href={openUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
            >
              Open in Grafana
            </a>
          </div>
        </noscript>
      </div>

      <p className="text-xs text-gray-400 text-right">
        Grafana · {dashboardLabel(activeDash, activeDashId)} · {from} → {to}
      </p>
    </div>
  );
}
