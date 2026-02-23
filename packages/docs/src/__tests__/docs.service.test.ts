import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocsService } from '../docs.service.js';
import { NotFoundError, ValidationError } from '@forgeportal/core';
import type { DocsRepository, DocsBinding } from '../docs.repository.js';
import type { SCMProviders, SCMProvider } from '@forgeportal/scm';
import type { AppConfig } from '@forgeportal/core';

function makeRepo(binding: DocsBinding | null): Partial<DocsRepository> {
  return {
    getBinding: vi.fn(async () => binding),
    listPages: vi.fn(async () => [{ path: 'docs/index.md', title: 'Index' }]),
  };
}

function makeProvider(content: string | null): Partial<SCMProvider> {
  return {
    getFile: vi.fn(async () =>
      content !== null
        ? { content, sha: 'abc', path: 'docs/index.md', encoding: 'utf-8' as const }
        : null,
    ),
  };
}

function makeScmProviders(provider: Partial<SCMProvider> | null): SCMProviders {
  return {
    github: null,
    gitlab: null,
    all: () => (provider ? [provider as SCMProvider] : []),
    get: (_: string) => (provider as SCMProvider) ?? null,
  };
}

const baseConfig = {
  scm: { github: {}, gitlab: { baseUrl: 'https://gitlab.com' } },
} as unknown as AppConfig;

const ghBinding: DocsBinding = {
  entity_id: 'ent-1',
  repo_url: 'https://github.com/myorg/myrepo',
  docs_path: 'docs',
  last_indexed_at: null,
};

describe('DocsService', () => {
  let service: DocsService;

  beforeEach(() => {
    const repo = makeRepo(ghBinding);
    const provider = makeProvider('# Hello\n\nContent');
    service = new DocsService(
      repo as DocsRepository,
      makeScmProviders(provider),
      baseConfig,
    );
  });

  it('listPages — no binding → throws NotFoundError', async () => {
    const repo = makeRepo(null);
    const svc = new DocsService(repo as DocsRepository, makeScmProviders(null), baseConfig);
    await expect(svc.listPages('ent-x')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('renderPage — path outside docs_path → throws ValidationError', async () => {
    await expect(service.renderPage('ent-1', 'README.md')).rejects.toBeInstanceOf(ValidationError);
  });

  it('renderPage — path traversal → throws ValidationError', async () => {
    await expect(service.renderPage('ent-1', 'docs/../etc/passwd')).rejects.toBeInstanceOf(ValidationError);
  });

  it('renderPage — SCM getFile returns null → throws NotFoundError', async () => {
    const repo = makeRepo(ghBinding);
    const provider = makeProvider(null);
    const svc = new DocsService(repo as DocsRepository, makeScmProviders(provider), baseConfig);
    await expect(svc.renderPage('ent-1', 'docs/missing.md')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('renderPage — valid file → returns html and extracted title', async () => {
    const result = await service.renderPage('ent-1', 'docs/index.md');
    expect(result.html).toContain('<h1>Hello</h1>');
    expect(result.title).toBe('Hello');
    expect(result.entityId).toBe('ent-1');
    expect(result.path).toBe('docs/index.md');
  });

  it('renderPage — no SCM provider → throws NotFoundError', async () => {
    const repo = makeRepo(ghBinding);
    const svc = new DocsService(repo as DocsRepository, makeScmProviders(null), baseConfig);
    await expect(svc.renderPage('ent-1', 'docs/index.md')).rejects.toBeInstanceOf(NotFoundError);
  });
});
