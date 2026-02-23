import type { Pool } from 'pg';
import type { AppConfig, Logger } from '@forgeportal/core';
import type { SCMProviders } from '@forgeportal/scm';
import { scanOrg, type ScanResult } from './scanner.js';

export interface RunScanOptions {
  config: AppConfig;
  pool: Pool;
  scmProviders: SCMProviders;
  logger: Logger;
  orgFilter?: string;
}

export async function runRepoScan(
  opts: RunScanOptions,
): Promise<ScanResult[]> {
  const { config, pool, scmProviders, logger, orgFilter } = opts;
  const results: ScanResult[] = [];

  let orgs = config.discovery.orgs;
  if (orgFilter) {
    orgs = orgs.filter((o) => o.org === orgFilter);
  }

  if (orgs.length === 0) {
    logger.warn('No discovery orgs configured — skipping scan');
    return results;
  }

  if (scmProviders.all().length === 0) {
    logger.warn('No SCM providers available — skipping scan');
    return results;
  }

  for (const entry of orgs) {
    const provider = scmProviders.get(entry.provider);
    if (!provider) {
      logger.warn(
        { provider: entry.provider, org: entry.org },
        'SCM provider not configured — skipping org',
      );
      continue;
    }

    const result = await scanOrg({
      provider,
      org: entry.org,
      topic: entry.topic,
      entityFilePath: config.discovery.entityFilePath,
      pool,
      logger,
    });
    results.push(result);
  }

  const totals = results.reduce(
    (acc, r) => ({
      scanned: acc.scanned + r.reposScanned,
      created: acc.created + r.entitiesCreated,
      updated: acc.updated + r.entitiesUpdated,
      skipped: acc.skipped + r.skipped,
      errors: acc.errors + r.errors,
    }),
    { scanned: 0, created: 0, updated: 0, skipped: 0, errors: 0 },
  );

  logger.info(totals, 'Repo scan completed (all orgs)');

  return results;
}
