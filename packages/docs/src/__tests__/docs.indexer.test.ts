import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import type { SCMProviders, SCMProvider } from '@forgeportal/scm';
import type { Logger } from '@forgeportal/core';
import type { DocsBinding } from '../docs.repository.js';
import { hashContent } from '../text-extractor.js';

const mockUpsertPage = vi.fn();
const mockGetBinding = vi.fn();
const mockGetContentHash = vi.fn();
const mockGetAllPaths = vi.fn();
const mockDeletePages = vi.fn();
const mockUpdateLastIndexedAt = vi.fn();

vi.mock('../docs.repository.js', () => ({
  DocsRepository: vi.fn().mockImplementation(() => ({
    getBinding: mockGetBinding,
    getContentHash: mockGetContentHash,
    getAllPaths: mockGetAllPaths,
    upsertPage: mockUpsertPage,
    deletePages: mockDeletePages,
    updateLastIndexedAt: mockUpdateLastIndexedAt,
  })),
}));

import { indexDocs } from '../docs.indexer.js';

const ENTITY_ID = 'ent-uuid-1';
const REPO_URL = 'https://github.com/org/repo';

const binding: DocsBinding = {
  entity_id: ENTITY_ID,
  repo_url: REPO_URL,
  docs_path: 'docs',
  last_indexed_at: null,
};

const mdContent1 = '# Page One\nHello world';
const mdContent2 = '# Page Two\nFoo bar';

function makeProvider(files: string[], contents: Record<string, string | null>): Partial<SCMProvider> {
  return {
    listFiles: vi.fn(async () => files),
    getFile: vi.fn(async (_ref, path: string) => {
      const c = contents[path];
      if (c === undefined || c === null) return null;
      return { content: c, sha: 'abc', path, encoding: 'utf-8' as const };
    }),
  };
}

function makeScmProviders(provider: Partial<SCMProvider>): SCMProviders {
  return {
    github: null,
    gitlab: null,
    all: () => [provider as SCMProvider],
    get: () => provider as SCMProvider,
  };
}

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

const mockPool = {} as Pool;

beforeEach(() => {
  vi.clearAllMocks();
  mockDeletePages.mockResolvedValue(0);
  mockUpdateLastIndexedAt.mockResolvedValue(undefined);
});

describe('indexDocs', () => {
  it('returns graceful no-op when no binding found (AC: 6)', async () => {
    mockGetBinding.mockResolvedValue(null);
    const provider = makeProvider([], {});
    const result = await indexDocs({
      entityId: ENTITY_ID,
      repoUrl: REPO_URL,
      pool: mockPool,
      scmProviders: makeScmProviders(provider),
      logger: noopLogger,
    });
    expect(result).toEqual({ entityId: ENTITY_ID, indexed: 0, skipped: 0, skippedSize: 0, deleted: 0, errors: 0 });
    expect(mockUpsertPage).not.toHaveBeenCalled();
    expect(mockUpdateLastIndexedAt).not.toHaveBeenCalled();
  });

  it('indexes 2 new files (AC: 1, 2)', async () => {
    mockGetBinding.mockResolvedValue(binding);
    mockGetContentHash.mockResolvedValue(null);
    mockGetAllPaths.mockResolvedValue([]);
    const provider = makeProvider(
      ['docs/index.md', 'docs/api.md'],
      { 'docs/index.md': mdContent1, 'docs/api.md': mdContent2 },
    );
    const result = await indexDocs({
      entityId: ENTITY_ID,
      repoUrl: REPO_URL,
      pool: mockPool,
      scmProviders: makeScmProviders(provider),
      logger: noopLogger,
    });
    expect(result.indexed).toBe(2);
    expect(result.skipped).toBe(0);
    expect(mockUpsertPage).toHaveBeenCalledTimes(2);
  });

  it('skips files with unchanged hash (AC: 3)', async () => {
    mockGetBinding.mockResolvedValue(binding);
    mockGetContentHash.mockImplementation(async (_eid, path) => {
      if (path === 'docs/index.md') return hashContent(mdContent1);
      return hashContent(mdContent2);
    });
    mockGetAllPaths.mockResolvedValue(['docs/index.md', 'docs/api.md']);
    const provider = makeProvider(
      ['docs/index.md', 'docs/api.md'],
      { 'docs/index.md': mdContent1, 'docs/api.md': mdContent2 },
    );
    const result = await indexDocs({
      entityId: ENTITY_ID,
      repoUrl: REPO_URL,
      pool: mockPool,
      scmProviders: makeScmProviders(provider),
      logger: noopLogger,
    });
    expect(result.skipped).toBe(2);
    expect(result.indexed).toBe(0);
    expect(mockUpsertPage).not.toHaveBeenCalled();
  });

  it('re-indexes files whose hash changed (AC: 2)', async () => {
    mockGetBinding.mockResolvedValue(binding);
    mockGetContentHash.mockResolvedValue('old-hash-different');
    mockGetAllPaths.mockResolvedValue(['docs/index.md', 'docs/api.md']);
    const provider = makeProvider(
      ['docs/index.md', 'docs/api.md'],
      { 'docs/index.md': mdContent1, 'docs/api.md': mdContent2 },
    );
    const result = await indexDocs({
      entityId: ENTITY_ID,
      repoUrl: REPO_URL,
      pool: mockPool,
      scmProviders: makeScmProviders(provider),
      logger: noopLogger,
    });
    expect(result.indexed).toBe(2);
    expect(result.skipped).toBe(0);
  });

  it('deletes orphaned pages on full run (AC: 7)', async () => {
    mockGetBinding.mockResolvedValue(binding);
    mockGetContentHash.mockResolvedValue(null);
    mockGetAllPaths.mockResolvedValue(['docs/index.md', 'docs/old.md']);
    mockDeletePages.mockResolvedValue(1);
    const provider = makeProvider(
      ['docs/index.md'],
      { 'docs/index.md': mdContent1 },
    );
    const result = await indexDocs({
      entityId: ENTITY_ID,
      repoUrl: REPO_URL,
      pool: mockPool,
      scmProviders: makeScmProviders(provider),
      logger: noopLogger,
    });
    expect(result.deleted).toBe(1);
    expect(mockDeletePages).toHaveBeenCalledWith(ENTITY_ID, ['docs/old.md']);
  });

  it('updates last_indexed_at after successful run (AC: 8)', async () => {
    mockGetBinding.mockResolvedValue(binding);
    mockGetContentHash.mockResolvedValue(null);
    mockGetAllPaths.mockResolvedValue([]);
    const provider = makeProvider(['docs/index.md'], { 'docs/index.md': mdContent1 });
    await indexDocs({
      entityId: ENTITY_ID,
      repoUrl: REPO_URL,
      pool: mockPool,
      scmProviders: makeScmProviders(provider),
      logger: noopLogger,
    });
    expect(mockUpdateLastIndexedAt).toHaveBeenCalledWith(ENTITY_ID);
  });

  it('isolates per-file errors without aborting the run (AC: 1.2)', async () => {
    mockGetBinding.mockResolvedValue(binding);
    mockGetAllPaths.mockResolvedValue([]);
    mockGetContentHash
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('DB error'));
    const provider = makeProvider(
      ['docs/index.md', 'docs/bad.md'],
      { 'docs/index.md': mdContent1, 'docs/bad.md': mdContent2 },
    );
    const result = await indexDocs({
      entityId: ENTITY_ID,
      repoUrl: REPO_URL,
      pool: mockPool,
      scmProviders: makeScmProviders(provider),
      logger: noopLogger,
    });
    expect(result.indexed).toBe(1);
    expect(result.errors).toBe(1);
  });

  it('only fetches changedPaths on partial run (AC: 5 + webhook)', async () => {
    mockGetBinding.mockResolvedValue(binding);
    mockGetContentHash.mockResolvedValue(null);
    const provider = makeProvider(
      ['docs/index.md', 'docs/api.md'],
      { 'docs/index.md': mdContent1, 'docs/api.md': mdContent2 },
    );
    const result = await indexDocs({
      entityId: ENTITY_ID,
      repoUrl: REPO_URL,
      changedPaths: ['docs/index.md'],
      pool: mockPool,
      scmProviders: makeScmProviders(provider),
      logger: noopLogger,
    });
    expect(result.indexed).toBe(1);
    expect(mockDeletePages).not.toHaveBeenCalled();
  });

  it('does not run orphan deletion on partial run', async () => {
    mockGetBinding.mockResolvedValue(binding);
    mockGetContentHash.mockResolvedValue(null);
    const provider = makeProvider(
      ['docs/index.md'],
      { 'docs/index.md': mdContent1 },
    );
    await indexDocs({
      entityId: ENTITY_ID,
      repoUrl: REPO_URL,
      changedPaths: ['docs/index.md'],
      pool: mockPool,
      scmProviders: makeScmProviders(provider),
      logger: noopLogger,
    });
    expect(mockGetAllPaths).not.toHaveBeenCalled();
    expect(mockDeletePages).not.toHaveBeenCalled();
  });

  it('skips files exceeding maxIndexFileSizeBytes and increments skippedSize', async () => {
    const smallContent = '# Small\nok';
    const bigContent = 'x'.repeat(300);
    mockGetBinding.mockResolvedValue(binding);
    mockGetContentHash.mockResolvedValue(null);
    mockGetAllPaths.mockResolvedValue([]);
    const provider = makeProvider(
      ['docs/small.md', 'docs/big.md'],
      { 'docs/small.md': smallContent, 'docs/big.md': bigContent },
    );
    const result = await indexDocs({
      entityId: ENTITY_ID,
      repoUrl: REPO_URL,
      pool: mockPool,
      scmProviders: makeScmProviders(provider),
      logger: noopLogger,
      maxIndexFileSizeBytes: 100,
    });
    expect(result.indexed).toBe(1);
    expect(result.skippedSize).toBe(1);
    expect(result.errors).toBe(0);
    expect(mockUpsertPage).toHaveBeenCalledTimes(1);
    expect(noopLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: 'docs/big.md',
        contentSize: 300,
        maxIndexFileSizeBytes: 100,
      }),
      'docs-index: file exceeds max size, skipping',
    );
  });
});
