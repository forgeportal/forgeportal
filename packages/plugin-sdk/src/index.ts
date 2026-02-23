// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  Entity,
  EntityDraft,
  EntityTab,
  EntityTabAppliesTo,
  EntityCard,
  Route,
  JsonSchema,
  JsonSchemaType,
  ActionResult,
  ActionLogger,
  ActionScmAccessor,
  ActionDbAccessor,
  ActionConfigAccessor,
  ActionContext,
  ActionProvider,
  CatalogProviderContext,
  CatalogProvider,
  ForgePluginSDK,
  PluginConfigFieldSchema,
  PluginCapabilities,
  PluginManifest,
} from './types.js';

// ─── Registry ─────────────────────────────────────────────────────────────────
export { PluginRegistry, globalRegistry } from './registry.js';

// ─── Backend SDK (for backend and fullstack plugins) ─────────────────────────
export type { BackendRoute, ForgeBackendPluginSDK } from './backend.js';
export { BackendPluginRegistry } from './backend.js';

// ─── SDK version (used by plugin loader for engineVersion compatibility check) ─
export const SDK_VERSION = '1.0.0';
