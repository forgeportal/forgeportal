import { api } from './api.js';

export interface DocsPageSummary {
  path: string;
  title: string | null;
}

export interface DocsPageListResponse {
  entityId: string;
  docsPath: string;
  pages: DocsPageSummary[];
}

export interface DocsPageResponse {
  entityId: string;
  path: string;
  html: string;
  title: string | null;
}

export function fetchDocsList(
  entityId: string,
): Promise<{ data: DocsPageListResponse }> {
  return api.get<{ data: DocsPageListResponse }>(`/docs/${entityId}`);
}

export function fetchDocsPage(
  entityId: string,
  path: string,
): Promise<{ data: DocsPageResponse }> {
  const qs = new URLSearchParams({ path });
  return api.get<{ data: DocsPageResponse }>(`/docs/${entityId}/page?${qs.toString()}`);
}
