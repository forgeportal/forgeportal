import yaml from 'js-yaml';
import type { Pool } from 'pg';
import type { Logger } from '@forgeportal/core';
import { ConflictError } from '@forgeportal/core';
import type { SCMProvider, RepoSummary, RepoRef } from '@forgeportal/scm';
import { entityYamlSchema, type EntityYaml } from './entity-yaml.schema.js';
import { EntityRepository } from './entity.repository.js';
import { SourceRepository } from './source.repository.js';
import { enqueueScorecardEvalJobs } from './scorecard-trigger.js';

export interface ScanOrgOptions {
  provider: SCMProvider;
  org: string;
  topic?: string;
  entityFilePath: string;
  pool: Pool;
  logger: Logger;
}

export interface ScanResult {
  org: string;
  provider: string;
  reposScanned: number;
  entitiesCreated: number;
  entitiesUpdated: number;
  skipped: number;
  errors: number;
  duration: number;
}

export interface UpsertEntityFromYamlOpts {
  yaml: EntityYaml;
  repoSummary: { ref: RepoRef; url: string; defaultBranch: string };
  provider: string;
  entityFilePath: string;
  entityRepo: EntityRepository;
  sourceRepo: SourceRepository;
  pool: Pool;
  logger: Logger;
}

export function mapYamlToInput(
  data: EntityYaml,
  repoUrl: string,
  providerName: string,
  defaultBranch: string,
) {
  return {
    kind: data.kind,
    name: data.metadata.name,
    namespace: data.metadata.namespace,
    owner_ref: data.spec.owner,
    lifecycle: data.spec.lifecycle,
    tags: data.metadata.tags,
    links: data.metadata.links,
    annotations: data.metadata.annotations ?? {},
    scm: {
      repoUrl,
      provider: providerName,
      defaultBranch,
    },
    spec: data.spec,
    relations: [],
  };
}

export async function upsertEntityFromYaml(
  opts: UpsertEntityFromYamlOpts,
): Promise<{ action: 'created' | 'updated'; entityId: string; entityKind: string }> {
  const { yaml: yamlData, repoSummary, provider, entityFilePath, entityRepo, sourceRepo, pool } = opts;
  const entityData = mapYamlToInput(yamlData, repoSummary.url, provider, repoSummary.defaultBranch);

  let entityId: string;
  let action: 'created' | 'updated';

  try {
    const created = await entityRepo.create(entityData);
    entityId = created.id;
    action = 'created';
  } catch (err) {
    if (err instanceof ConflictError) {
      const existing = await entityRepo.findByRef(
        entityData.kind,
        entityData.namespace ?? 'default',
        entityData.name,
      );
      if (!existing) throw new Error('Entity conflict but not found by ref');
      const updated = await entityRepo.update(existing.id, entityData);
      entityId = updated.id;
      action = 'updated';
    } else {
      throw err;
    }
  }

  await sourceRepo.upsertSource({
    entity_id: entityId,
    provider,
    repo_url: repoSummary.url,
    path: entityFilePath,
  });

  await pool.query(
    'UPDATE entity_sources SET last_seen_at = now() WHERE entity_id = $1 AND provider = $2',
    [entityId, provider],
  );

  return { action, entityId, entityKind: entityData.kind };
}

export async function scanOrg(opts: ScanOrgOptions): Promise<ScanResult> {
  const { provider, org, topic, entityFilePath, pool, logger } = opts;
  const entityRepo = new EntityRepository(pool);
  const sourceRepo = new SourceRepository(pool);
  const start = Date.now();

  const counters = {
    reposScanned: 0,
    entitiesCreated: 0,
    entitiesUpdated: 0,
    skipped: 0,
    errors: 0,
  };

  for await (const repo of provider.listRepos({ org, topic })) {
    counters.reposScanned++;
    try {
      await processRepo(repo);
    } catch (err) {
      counters.errors++;
      logger.error(
        { err, repo: repo.fullName },
        'Unexpected error processing repo',
      );
    }
  }

  const result: ScanResult = {
    org,
    provider: provider.name,
    ...counters,
    duration: Date.now() - start,
  };

  logger.info(
    {
      org,
      provider: provider.name,
      scanned: counters.reposScanned,
      created: counters.entitiesCreated,
      updated: counters.entitiesUpdated,
      skipped: counters.skipped,
      errors: counters.errors,
      durationMs: result.duration,
    },
    'Org scan completed',
  );

  return result;

  async function processRepo(repo: RepoSummary): Promise<void> {
    const file = await provider.getFile(repo.ref, entityFilePath);
    if (!file) {
      counters.skipped++;
      logger.debug({ repo: repo.fullName }, 'No entity file, skipping');
      return;
    }

    let parsed: unknown;
    try {
      parsed = yaml.load(file.content);
    } catch {
      counters.errors++;
      logger.warn({ repo: repo.fullName }, 'Invalid YAML in entity file');
      return;
    }

    const validated = entityYamlSchema.safeParse(parsed);
    if (!validated.success) {
      counters.errors++;
      logger.warn(
        { repo: repo.fullName, errors: validated.error.issues },
        'Entity YAML validation failed',
      );
      return;
    }

    try {
      const result = await upsertEntityFromYaml({
        yaml: validated.data,
        repoSummary: { ref: repo.ref, url: repo.url, defaultBranch: repo.defaultBranch },
        provider: provider.name,
        entityFilePath,
        entityRepo,
        sourceRepo,
        pool,
        logger,
      });
      if (result.action === 'created') counters.entitiesCreated++;
      else counters.entitiesUpdated++;

      // Auto-trigger scorecard eval after every upsert (deduped).
      enqueueScorecardEvalJobs(pool, result.entityId, result.entityKind, false).catch((err) => {
        logger.warn({ err, entityId: result.entityId }, 'Failed to enqueue scorecard-eval after scan');
      });
    } catch {
      counters.errors++;
    }
  }
}
