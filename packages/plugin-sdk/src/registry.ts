import type {
  ForgePluginSDK,
  EntityTab,
  EntityCard,
  Route,
  ActionProvider,
  CatalogProvider,
} from './types.js';

/**
 * In-memory registry — the canonical implementation of ForgePluginSDK.
 * Instantiated once per app (API or UI) at startup.
 * Plugins receive this as the `sdk` argument in `registerPlugin(sdk)`.
 */
export class PluginRegistry implements ForgePluginSDK {
  private readonly _entityTabs       = new Map<string, EntityTab>();
  private readonly _entityCards      = new Map<string, EntityCard>();
  private readonly _routes           = new Map<string, Route>();
  private readonly _actionProviders  = new Map<string, ActionProvider>();
  private readonly _catalogProviders = new Map<string, CatalogProvider>();

  registerEntityTab(tab: EntityTab): void {
    if (this._entityTabs.has(tab.id)) {
      console.warn(`[ForgePortal SDK] EntityTab "${tab.id}" already registered — skipping duplicate.`);
      return;
    }
    this._entityTabs.set(tab.id, tab);
  }

  registerEntityCard(card: EntityCard): void {
    if (this._entityCards.has(card.id)) {
      console.warn(`[ForgePortal SDK] EntityCard "${card.id}" already registered — skipping duplicate.`);
      return;
    }
    this._entityCards.set(card.id, card);
  }

  registerRoute(route: Route): void {
    if (this._routes.has(route.path)) {
      console.warn(`[ForgePortal SDK] Route "${route.path}" already registered — skipping duplicate.`);
      return;
    }
    this._routes.set(route.path, route);
  }

  registerActionProvider(provider: ActionProvider): void {
    const key = `${provider.id}@${provider.version}`;
    if (this._actionProviders.has(key)) {
      console.warn(`[ForgePortal SDK] ActionProvider "${key}" already registered — skipping duplicate.`);
      return;
    }
    this._actionProviders.set(key, provider);
  }

  registerCatalogProvider(provider: CatalogProvider): void {
    if (this._catalogProviders.has(provider.id)) {
      console.warn(`[ForgePortal SDK] CatalogProvider "${provider.id}" already registered — skipping duplicate.`);
      return;
    }
    this._catalogProviders.set(provider.id, provider);
  }

  // ─── Getters (used by the app shell to read registered capabilities) ────────

  /**
   * Returns entity tabs, optionally filtered by entity kind.
   * Tabs with no `appliesTo.kinds` constraint match all kinds.
   */
  getEntityTabs(entityKind?: string): EntityTab[] {
    const all = Array.from(this._entityTabs.values());
    if (!entityKind) return all;
    return all.filter(t =>
      !t.appliesTo?.kinds || t.appliesTo.kinds.includes(entityKind),
    );
  }

  getEntityCards(entityKind?: string): EntityCard[] {
    const all = Array.from(this._entityCards.values());
    if (!entityKind) return all;
    return all.filter(c =>
      !c.appliesTo?.kinds || c.appliesTo.kinds.includes(entityKind),
    );
  }

  getRoutes(): Route[] {
    return Array.from(this._routes.values());
  }

  getActionProviders(): ActionProvider[] {
    return Array.from(this._actionProviders.values());
  }

  getActionProvider(id: string, version: string): ActionProvider | undefined {
    return this._actionProviders.get(`${id}@${version}`);
  }

  getCatalogProviders(): CatalogProvider[] {
    return Array.from(this._catalogProviders.values());
  }
}

/** Global singleton — used by the app shell (API and UI). */
export const globalRegistry = new PluginRegistry();
