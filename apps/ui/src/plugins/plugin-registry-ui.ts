import {
  PluginRegistry,
  type ForgePluginSDK,
  type EntityTab,
  type EntityCard,
  type Route,
} from '@forgeportal/plugin-sdk';

/**
 * Global plugin registry singleton for the UI shell.
 * All plugin registrations go through this instance.
 */
export const registry = new PluginRegistry();

// Ownership maps: capability ID → plugin ID
// Used to filter disabled plugins without modifying the PluginRegistry API.
export const tabOwnership   = new Map<string, string>(); // tabId     → pluginId
export const cardOwnership  = new Map<string, string>(); // cardId    → pluginId
export const routeOwnership = new Map<string, string>(); // routePath → pluginId

/**
 * Registers a UI plugin and tracks which plugin owns each capability.
 *
 * @param pluginId   - URL-safe plugin ID matching the backend's derived ID, e.g. "pagerduty"
 * @param registerFn - The plugin's exported `registerPlugin` function
 *
 * @example
 * // apps/ui/src/plugins/index.ts
 * import { registerPlugin as registerPagerDuty } from '@myorg/forge-plugin-pagerduty';
 * registerPluginById('pagerduty', registerPagerDuty);
 */
export function registerPluginById(
  pluginId:   string,
  registerFn: (sdk: ForgePluginSDK) => void,
): void {
  const trackingProxy: ForgePluginSDK = {
    registerEntityTab(tab: EntityTab) {
      tabOwnership.set(tab.id, pluginId);
      registry.registerEntityTab(tab);
    },
    registerEntityCard(card: EntityCard) {
      cardOwnership.set(card.id, pluginId);
      registry.registerEntityCard(card);
    },
    registerRoute(route: Route) {
      routeOwnership.set(route.path, pluginId);
      registry.registerRoute(route);
    },
    registerActionProvider() {
      console.warn(
        `[ForgePortal UI] registerActionProvider() has no effect in the UI. ` +
        `Use a backend plugin for actions.`,
      );
    },
    registerCatalogProvider() {
      console.warn(
        `[ForgePortal UI] registerCatalogProvider() has no effect in the UI. ` +
        `Use a backend plugin for catalog providers.`,
      );
    },
  };

  try {
    registerFn(trackingProxy);
  } catch (err) {
    console.error(`[ForgePortal UI] Plugin "${pluginId}" registerPlugin() threw an error:`, err);
  }
}
