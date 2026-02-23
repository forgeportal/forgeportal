import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Pool } from 'pg';
import type { Logger, AppConfig } from '@forgeportal/core';
import type { SCMProviders } from '@forgeportal/scm';

const { mockIndexDocs, mockRunRepoScan } = vi.hoisted(() => ({
  mockIndexDocs: vi.fn(),
  mockRunRepoScan: vi.fn(),
}));

vi.mock('@forgeportal/docs', () => ({ indexDocs: mockIndexDocs }));
vi.mock('@forgeportal/catalog', () => ({ runRepoScan: mockRunRepoScan }));

import { createJobHandlers } from '../handlers.js';

const mockPool = {} as Pool;
const mockScmProviders = {} as SCMProviders;
const mockConfig = {} as AppConfig;
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

function makeHandlers() {
  return createJobHandlers({
    pool: mockPool,
    scmProviders: mockScmProviders,
    config: mockConfig,
    logger: mockLogger,
  });
}

beforeEach(() => vi.clearAllMocks());

describe('docs-index job handler', () => {
  it('logs warning and returns without throwing when payload is missing entityId or repoUrl', async () => {
    const handlers = makeHandlers();
    await expect(
      handlers['docs-index']!({ repoUrl: 'https://github.com/org/repo' }),
    ).resolves.toBeUndefined();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ payload: expect.anything() }),
      'docs-index job missing entityId or repoUrl',
    );
    expect(mockIndexDocs).not.toHaveBeenCalled();
  });

  it('calls indexDocs with the correct arguments when payload is valid', async () => {
    mockIndexDocs.mockResolvedValue({
      entityId: 'ent-1',
      indexed: 2,
      skipped: 0,
      deleted: 0,
      errors: 0,
    });

    const handlers = makeHandlers();
    const payload = {
      entityId: 'ent-1',
      repoUrl: 'https://github.com/org/repo',
      changedPaths: ['docs/index.md'],
    };

    await handlers['docs-index']!(payload);

    expect(mockIndexDocs).toHaveBeenCalledWith({
      entityId: 'ent-1',
      repoUrl: 'https://github.com/org/repo',
      changedPaths: ['docs/index.md'],
      pool: mockPool,
      scmProviders: mockScmProviders,
      logger: mockLogger,
    });
    expect(mockLogger.info).toHaveBeenCalled();
  });
});
