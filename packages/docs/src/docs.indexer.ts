import type { Pool } from 'pg';
import type { Logger } from '@forgeportal/core';
import type { SCMProviders } from '@forgeportal/scm';
import { DocsRepository } from './docs.repository.js';
import { extractPlainText, hashContent } from './text-extractor.js';
import { parseRepoRef, detectProvider } from './scm-utils.js';

export interface IndexDocsOptions {
  entityId: string;
  repoUrl: string;
  changedPaths?: string[];
  pool: Pool;
  scmProviders: SCMProviders;
  logger: Logger;
  /** GitLab base URL for self-hosted instances (e.g. "https://gitlab.mycompany.com"). */
  gitlabBaseUrl?: string;
  /** Max size in bytes per file; larger files are skipped (default 5 MB). */
  maxIndexFileSizeBytes?: number;
}

export interface IndexDocsResult {
  entityId: string;
  indexed: number;
  skipped: number;
  skippedSize: number;
  deleted: number;
  errors: number;
}

function extractTitleFromMarkdown(markdown: string): string | null {
  const match = /^#\s+(.+)/m.exec(markdown);
  return match ? match[1]?.trim() ?? null : null;
}

export async function indexDocs(
  opts: IndexDocsOptions,
): Promise<IndexDocsResult> {
  const {
    entityId,
    repoUrl,
    changedPaths,
    pool,
    scmProviders,
    logger,
    gitlabBaseUrl,
    maxIndexFileSizeBytes = 5 * 1024 * 1024,
  } = opts;

  const result: IndexDocsResult = {
    entityId,
    indexed: 0,
    skipped: 0,
    skippedSize: 0,
    deleted: 0,
    errors: 0,
  };

  const repository = new DocsRepository(pool);

  const binding = await repository.getBinding(entityId);
  if (!binding) {
    logger.debug({ entityId }, 'docs-index: no binding found, graceful no-op');
    return result;
  }

  const providerName = detectProvider(repoUrl, gitlabBaseUrl);
  if (!providerName) {
    throw new Error(`Cannot determine SCM provider from repo URL: ${repoUrl}`);
  }

  const provider = scmProviders.get(providerName);
  if (!provider) {
    throw new Error(`SCM provider '${providerName}' not configured`);
  }

  const ref = parseRepoRef(repoUrl);
  if (!ref) {
    throw new Error(`Invalid repository URL: ${repoUrl}`);
  }

  let listedFiles = await provider.listFiles(ref, binding.docs_path);

  const isPartialRun = Array.isArray(changedPaths) && changedPaths.length > 0;
  if (isPartialRun) {
    const changedSet = new Set(changedPaths);
    listedFiles = listedFiles.filter((f: string) => changedSet.has(f));
  }

  for (const filePath of listedFiles) {
    try {
      const fileContent = await provider.getFile(ref, filePath);
      if (!fileContent) {
        logger.debug({ entityId, filePath }, 'docs-index: file not found, skipping');
        continue;
      }

      const raw = fileContent.content;
      const contentSize =
        typeof raw === 'string'
          ? Buffer.byteLength(raw, 'utf8')
          : Buffer.byteLength(raw as Buffer);
      if (contentSize > maxIndexFileSizeBytes) {
        logger.warn(
          { entityId, filePath, contentSize, maxIndexFileSizeBytes },
          'docs-index: file exceeds max size, skipping',
        );
        result.skippedSize++;
        continue;
      }

      const contentHash = hashContent(fileContent.content);
      const existingHash = await repository.getContentHash(entityId, filePath);

      if (existingHash === contentHash) {
        logger.debug({ entityId, filePath, action: 'skipped' }, 'docs-index: hash unchanged');
        result.skipped++;
        continue;
      }

      const contentText = extractPlainText(fileContent.content);
      const title = extractTitleFromMarkdown(fileContent.content);

      await repository.upsertPage({
        entityId,
        path: filePath,
        title,
        contentText,
        contentHash,
      });

      logger.debug({ entityId, filePath, action: 'indexed' }, 'docs-index: file indexed');
      result.indexed++;
    } catch (err) {
      logger.error({ err, entityId, filePath }, 'docs-index: error processing file');
      result.errors++;
    }
  }

  if (!isPartialRun) {
    const existingPaths = await repository.getAllPaths(entityId);
    const listedSet = new Set(listedFiles);
    const orphans = existingPaths.filter((p) => !listedSet.has(p));

    if (orphans.length > 0) {
      const deleted = await repository.deletePages(entityId, orphans);
      result.deleted += deleted;
      for (const orphanPath of orphans) {
        logger.debug(
          { entityId, filePath: orphanPath, action: 'deleted' },
          'docs-index: orphan deleted',
        );
      }
    }
  }

  await repository.updateLastIndexedAt(entityId);

  logger.info({ entityId, result }, 'docs-index: completed');

  return result;
}
