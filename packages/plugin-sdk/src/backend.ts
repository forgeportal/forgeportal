import type { FastifyInstance } from 'fastify';
import type {
  ActionProvider,
  CatalogProvider,
  ActionConfigAccessor,
  ActionLogger,
} from './types.js';

/**
 * A backend route registration — Fastify plugin function scoped under
 * /api/v1/plugins/{pluginId}/{path}/
 */
export interface BackendRoute {
  /** Relative path prefix, e.g. '/alerts'. No leading slash required. */
  path:    string;
  /**
   * Fastify async plugin that registers route handlers.
   * Receives a Fastify instance pre-scoped to the plugin's route prefix.
   * Do NOT call fastify.listen() — only register routes.
   */
  handler: (fastify: FastifyInstance) => Promise<void>;
}

/**
 * The SDK object passed to backend and fullstack plugin entry points.
 * Distinct from ForgePluginSDK (which uses React components).
 *
 * Backend plugin entry: export function registerBackendPlugin(sdk: ForgeBackendPluginSDK): void
 */
export interface ForgeBackendPluginSDK {
  /** Plugin-scoped config accessor (from forgeportal.yaml plugins.<id>.config). */
  readonly config: ActionConfigAccessor;
  /** Structured logger scoped to this plugin. */
  readonly logger: ActionLogger;
  /** Register an action provider (available in action runner + templates). */
  registerActionProvider(provider: ActionProvider): void;
  /** Register a catalog provider (periodic ingestion of external entities). */
  registerCatalogProvider(provider: CatalogProvider): void;
  /**
   * Register backend routes under /api/v1/plugins/{pluginId}/{route.path}/
   * The Fastify instance passed to handler is already authenticated (authGuard runs).
   */
  registerBackendRoute(route: BackendRoute): void;
}

/**
 * Backend plugin registry — in-memory store for backend capabilities.
 * Instantiated by the plugin loader for each plugin.
 */
export class BackendPluginRegistry implements ForgeBackendPluginSDK {
  private readonly _actionProviders  = new Map<string, ActionProvider>();
  private readonly _catalogProviders = new Map<string, CatalogProvider>();
  private readonly _routes: BackendRoute[] = [];

  constructor(
    readonly config: ActionConfigAccessor,
    readonly logger: ActionLogger,
  ) {}

  registerActionProvider(provider: ActionProvider): void {
    const key = `${provider.id}@${provider.version}`;
    if (this._actionProviders.has(key)) {
      console.warn(`[ForgePortal SDK] ActionProvider "${key}" already registered — skipping.`);
      return;
    }
    this._actionProviders.set(key, provider);
  }

  registerCatalogProvider(provider: CatalogProvider): void {
    if (this._catalogProviders.has(provider.id)) {
      console.warn(`[ForgePortal SDK] CatalogProvider "${provider.id}" already registered — skipping.`);
      return;
    }
    this._catalogProviders.set(provider.id, provider);
  }

  registerBackendRoute(route: BackendRoute): void {
    this._routes.push(route);
  }

  getActionProviders():  ActionProvider[]  { return [...this._actionProviders.values()]; }
  getCatalogProviders(): CatalogProvider[] { return [...this._catalogProviders.values()]; }
  getBackendRoutes():    BackendRoute[]    { return [...this._routes]; }
}
