import type React from 'react';

// ─── Entity (subset of the catalog entity) ──────────────────────────────────

export interface Entity {
  id:           string;
  kind:         string;
  namespace:    string;
  name:         string;
  title?:       string;
  description?: string;
  tags?:        string[];
  links?:       Array<{ title: string; url: string }>;
  owner_ref?:   string;
  lifecycle?:   string;
  spec?:        Record<string, unknown>;
}

export interface EntityDraft {
  kind:         string;
  namespace:    string;
  name:         string;
  title?:       string;
  description?: string;
  tags?:        string[];
  links?:       Array<{ title: string; url: string }>;
  owner_ref?:   string;
  lifecycle?:   string;
  spec?:        Record<string, unknown>;
  relations?:   Array<{ type: string; targetRef: string }>;
  sources?:     Array<{ kind: string; url: string; ref?: string }>;
}

// ─── Capability types ────────────────────────────────────────────────────────

export interface EntityTabAppliesTo {
  kinds?:     string[];     // e.g. ['service', 'library'] — undefined = all kinds
  lifecycle?: string[];     // e.g. ['production'] — undefined = all lifecycles
}

export interface EntityTab {
  id:         string;
  title:      string;
  /** Rendered inside the entity detail page tab panel. Receives the current entity. */
  component:  React.ComponentType<{ entity: Entity }>;
  appliesTo?: EntityTabAppliesTo;
}

export interface EntityCard {
  id:         string;
  title:      string;
  /** Rendered as a card on the entity overview tab. */
  component:  React.ComponentType<{ entity: Entity }>;
  appliesTo?: { kinds?: string[] };
}

export interface Route {
  /** URL path, e.g. '/pagerduty'. Must be globally unique. */
  path:      string;
  component: React.ComponentType;
  /** If provided, appears in the sidebar navigation. */
  navLabel?: string;
  /** Optional icon name or emoji character. */
  icon?:     string;
}

// ─── JSON Schema (minimal subset for action input/output) ───────────────────

export type JsonSchemaType = 'string' | 'number' | 'boolean' | 'object' | 'array';

export interface JsonSchema {
  type:         JsonSchemaType | JsonSchemaType[];
  title?:       string;
  description?: string;
  properties?:  Record<string, JsonSchema>;
  required?:    string[];
  items?:       JsonSchema;
  enum?:        unknown[];
  default?:     unknown;
  /** Set true to mark as secret — redacted in audit logs. */
  'x-secret'?: boolean;
}

// ─── Action Provider ─────────────────────────────────────────────────────────

export interface ActionResult {
  status:    'success' | 'failed';
  outputs:   Record<string, unknown>;
  links?:    Array<{ title: string; url: string }>;
  warnings?: string[];
  error?:    { code: string; message: string };
}

export interface ActionLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface ActionScmAccessor {
  /** Returns file content as UTF-8 string, or null if not found. */
  getFile(repoUrl: string, path: string, ref?: string): Promise<string | null>;
  /** Lists file paths under prefix (streaming). */
  listFiles(repoUrl: string, prefix?: string): AsyncIterable<string>;
}

export interface ActionDbAccessor {
  /** Execute a read-only SQL query. Throws if the query mutates data. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface ActionConfigAccessor {
  /** Get a plugin-specific config value. Returns undefined if not set. */
  get<T = unknown>(key: string): T | undefined;
}

/**
 * Provided to every action handler at execution time.
 * Exposes safe, scoped access to infrastructure services.
 */
export interface ActionContext {
  /** Plugin-scoped config from forgeportal.yaml plugins.<pluginId>.config */
  config:  ActionConfigAccessor;
  /** Structured logger — writes to action run logs visible in the UI. */
  logger:  ActionLogger;
  /** SCM operations (getFile, listFiles). */
  scm:     ActionScmAccessor;
  /** Read-only database access. */
  db:      ActionDbAccessor;
  /**
   * Acquires an advisory lock on a repository URL.
   * Prevents concurrent SCM writes to the same repo within this action run.
   * Automatically released when the action run completes.
   */
  acquireRepoLock(repoUrl: string): Promise<void>;
  /**
   * Append a log line to the current action run log (persisted in DB,
   * visible in the Actions UI).
   */
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string): Promise<void>;
}

export interface ActionProvider {
  /** Globally unique action ID, e.g. "slack.sendMessage". */
  id:      string;
  /** Semantic version string, e.g. "v1". */
  version: string;
  schema: {
    input:   JsonSchema;
    output?: JsonSchema;
  };
  handler(ctx: ActionContext, input: Record<string, unknown>): Promise<ActionResult>;
}

// ─── Catalog Provider ────────────────────────────────────────────────────────

export interface CatalogProviderContext {
  logger: ActionLogger;
  config: ActionConfigAccessor;
}

export interface CatalogProvider {
  /** Globally unique provider ID, e.g. "pagerduty-catalog". */
  id:     string;
  /** Called periodically by the worker to ingest entities from an external system. */
  ingest(ctx: CatalogProviderContext): AsyncIterable<EntityDraft>;
}

// ─── Main SDK interface ──────────────────────────────────────────────────────

/**
 * The main SDK object passed to every plugin's `registerPlugin` function.
 * Plugins call `sdk.registerXxx(...)` to expose their capabilities to ForgePortal.
 */
export interface ForgePluginSDK {
  registerEntityTab(tab: EntityTab): void;
  registerEntityCard(card: EntityCard): void;
  registerRoute(route: Route): void;
  registerActionProvider(provider: ActionProvider): void;
  registerCatalogProvider(provider: CatalogProvider): void;
}

// ─── Plugin Manifest (forgeportal-plugin.json) ───────────────────────────────

export interface PluginConfigFieldSchema {
  type:         'string' | 'number' | 'boolean';
  description?: string;
  required?:    boolean;
  /** If true, the value must come from an env var and is never logged. */
  secret?:      boolean;
  default?:     string | number | boolean;
}

export interface PluginCapabilities {
  ui?: {
    entityTabs?:  string[];
    entityCards?: string[];
    routes?:      string[];
  };
  backend?: {
    routes?:            string[];   // relative path prefixes
    actionProviders?:   string[];   // action IDs
    catalogProviders?:  string[];   // provider IDs
  };
}

export interface PluginManifest {
  /** npm package name, e.g. "@myorg/forge-plugin-pagerduty" */
  name:    string;
  version: string;
  forgeportal: {
    /** semver range against @forgeportal/plugin-sdk version, e.g. "^1.0.0" */
    engineVersion: string;
    type:          'ui' | 'backend' | 'fullstack';
    capabilities:  PluginCapabilities;
    /** Required RBAC permissions, e.g. ["action:run"]. */
    permissions?:  string[];
    /** Config field schemas declared by the plugin. */
    config?:       Record<string, PluginConfigFieldSchema>;
  };
}
