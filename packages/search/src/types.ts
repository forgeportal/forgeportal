export type SearchScope = 'all' | 'entities' | 'docs';

export interface EntityMeta {
  kind: string;
  namespace: string;
  name: string;
  owner_ref: string | null;
  lifecycle: string | null;
}

export interface DocMeta {
  entity_id: string;
  path: string;
}

export interface SearchResultItem {
  type: 'entity' | 'doc';
  id: string;
  title: string;
  excerpt: string;
  url: string;
  score: number;
  meta: EntityMeta | DocMeta;
}

export interface SearchResponse {
  data: SearchResultItem[];
  pagination: {
    offset: number;
    limit: number;
    total: number;
  };
  query: string;
  scope: SearchScope;
}
