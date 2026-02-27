export const ENTITY_KINDS = [
  'service',
  'library',
  'website',
  'api',
  'component',
  'resource',
  'system',
  'domain',
  'group',
  'user',
  'template',
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export const ENTITY_LIFECYCLES = [
  'experimental',
  'development',
  'staging',
  'production',
  'deprecated',
] as const;
export type EntityLifecycle = (typeof ENTITY_LIFECYCLES)[number];

export const RELATION_TYPES = [
  'dependsOn',
  'ownedBy',
  'partOf',
  'providesApi',
  'consumesApi',
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export interface EntityRow {
  id: string;
  kind: string;
  namespace: string;
  name: string;
  owner_ref: string | null;
  lifecycle: string | null;
  tags: string[];
  links: { title: string; url: string }[];
  annotations: Record<string, string>;
  scm: Record<string, unknown>;
  spec: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface EntityRelationRow {
  id: string;
  from_entity_id: string;
  type: string;
  to_entity_id: string;
  created_at: Date;
}

export interface EntitySourceRow {
  id: string;
  entity_id: string;
  provider: string;
  repo_url: string;
  path: string;
  last_seen_at: Date | null;
  created_at: Date;
  updated_at: Date;
}
