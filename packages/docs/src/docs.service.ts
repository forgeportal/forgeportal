import { NotFoundError, ValidationError, assertSafeRelativePath } from '@forgeportal/core';
import type { SCMProviders } from '@forgeportal/scm';
import type { AppConfig } from '@forgeportal/core';
import type { DocsRepository } from './docs.repository.js';
import { renderMarkdown } from './renderer.js';
import { parseRepoRef, detectProvider as detectProviderBase } from './scm-utils.js';

export interface DocsPageListResponse {
  entityId: string;
  docsPath: string;
  pages: { path: string; title: string | null }[];
}

export interface DocsPageResponse {
  entityId: string;
  path: string;
  html: string;
  title: string | null;
}

function detectProvider(
  repoUrl: string,
  config: AppConfig,
): 'github' | 'gitlab' | null {
  return detectProviderBase(repoUrl, config.scm.gitlab.baseUrl ?? undefined);
}

function validateDocPath(requestedPath: string, docsPath: string): void {
  assertSafeRelativePath(requestedPath);
  const normalized = requestedPath.replace(/\\/g, '/').replace(/^\//, '');
  const prefix = docsPath.endsWith('/') ? docsPath : `${docsPath}/`;
  if (!normalized.startsWith(prefix) && normalized !== docsPath) {
    throw new ValidationError('Path outside docs directory');
  }
}

function extractTitle(html: string): string | null {
  const match = /<h1[^>]*>(.*?)<\/h1>/i.exec(html);
  if (!match) return null;
  return match[1]?.replace(/<[^>]+>/g, '').trim() ?? null;
}

export class DocsService {
  constructor(
    private readonly repository: DocsRepository,
    private readonly scmProviders: SCMProviders,
    private readonly config: AppConfig,
  ) {}

  async listPages(entityId: string): Promise<DocsPageListResponse> {
    const binding = await this.repository.getBinding(entityId);
    if (!binding) throw new NotFoundError(`No docs binding for entity ${entityId}`);

    const pages = await this.repository.listPages(entityId);
    return {
      entityId,
      docsPath: binding.docs_path,
      pages,
    };
  }

  async renderPage(
    entityId: string,
    filePath: string,
  ): Promise<DocsPageResponse> {
    const binding = await this.repository.getBinding(entityId);
    if (!binding) throw new NotFoundError(`No docs binding for entity ${entityId}`);

    validateDocPath(filePath, binding.docs_path);

    const providerName = detectProvider(binding.repo_url, this.config);
    if (!providerName)
      throw new NotFoundError('Cannot determine SCM provider from repo URL');

    const provider = this.scmProviders.get(providerName);
    if (!provider)
      throw new NotFoundError(`SCM provider '${providerName}' not configured`);

    const ref = parseRepoRef(binding.repo_url);
    if (!ref) throw new NotFoundError('Invalid repository URL');

    const fileContent = await provider.getFile(ref, filePath);
    if (!fileContent) throw new NotFoundError(`Doc page not found: ${filePath}`);

    const html = await renderMarkdown(fileContent.content);
    const title = extractTitle(html);

    return { entityId, path: filePath, html, title };
  }
}
