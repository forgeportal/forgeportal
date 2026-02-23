import { api } from './api.js';
import type {
  Entity,
  EntityWithRelations,
  PaginatedResponse,
  SearchResponse,
} from './types.js';

export interface EntityFilters {
  kind?: string;
  owner?: string;
  lifecycle?: string;
  tag?: string;
  q?: string;
  offset?: number;
  limit?: number;
}

export function fetchEntities(
  params: EntityFilters,
): Promise<PaginatedResponse<Entity>> {
  const qs = new URLSearchParams();
  if (params.kind) qs.set('kind', params.kind);
  if (params.owner) qs.set('owner', params.owner);
  if (params.lifecycle) qs.set('lifecycle', params.lifecycle);
  if (params.tag) qs.set('tag', params.tag);
  if (params.q) qs.set('q', params.q);
  if (params.offset !== undefined) qs.set('offset', String(params.offset));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  const query = qs.toString();
  return api.get<PaginatedResponse<Entity>>(
    `/catalog/entities${query ? `?${query}` : ''}`,
  );
}

export function fetchEntity(id: string): Promise<{ data: EntityWithRelations }> {
  return api.get<{ data: EntityWithRelations }>(`/catalog/entities/${id}`);
}

export function fetchSearch(q: string, scope = 'all'): Promise<SearchResponse> {
  const qs = new URLSearchParams({ q, scope });
  return api.get<SearchResponse>(`/search?${qs.toString()}`);
}
