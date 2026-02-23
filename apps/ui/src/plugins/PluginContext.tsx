import React, { createContext, useContext, useMemo } from 'react';
import type { EntityTab, EntityCard, Route } from '@forgeportal/plugin-sdk';
import { registry, tabOwnership, cardOwnership, routeOwnership } from './plugin-registry-ui.js';
import { usePluginStatus } from './usePluginStatus.js';

interface PluginContextValue {
  /**
   * Returns entity tabs registered by enabled plugins, filtered by entity kind.
   * Core (non-plugin) tabs are not included here — they're hardcoded in EntityDetailPage.
   */
  getEntityTabs(entityKind: string): EntityTab[];
  /**
   * Returns entity cards registered by enabled plugins, filtered by entity kind.
   */
  getEntityCards(entityKind: string): EntityCard[];
  /**
   * Returns top-level routes registered by enabled plugins.
   */
  getRoutes(): Route[];
  /**
   * True while plugin status is being fetched for the first time.
   * Used to avoid flash-of-missing-tabs before status resolves.
   */
  isLoading: boolean;
  /**
   * Returns the non-secret public config for a plugin ID.
   * Returns {} if the plugin is not found, is disabled, or has no config.
   * Config values come from forgeportal.yaml → resolvePluginConfig → status endpoint.
   */
  getPluginConfig(pluginId: string): Record<string, unknown>;
}

export const PluginContext = createContext<PluginContextValue>({
  getEntityTabs:   () => [],
  getEntityCards:  () => [],
  getRoutes:       () => [],
  isLoading:       false,
  getPluginConfig: () => ({}),
});

/**
 * Determines whether a capability owned by a plugin should be rendered.
 *
 * Rules:
 * - No owner (core capability) → always show.
 * - Loading → show optimistically.
 * - No enabledIds data → assume all plugins enabled.
 * - Otherwise → check owning plugin ID in enabledIds.
 */
function isEnabled(
  ownedBy:    string | undefined,
  enabledIds: Set<string>,
  isLoading:  boolean,
): boolean {
  if (!ownedBy)              return true; // core capability
  if (isLoading)             return true; // optimistic while loading
  if (enabledIds.size === 0) return true; // no status data → show all
  return enabledIds.has(ownedBy);
}

export function PluginProvider({ children }: { children: React.ReactNode }) {
  const { data: status, isLoading } = usePluginStatus();
  const enabledIds = useMemo(
    () => new Set(status?.enabledIds ?? []),
    [status?.enabledIds],
  );
  const configs = status?.configs ?? {};

  const value = useMemo<PluginContextValue>(() => ({
    isLoading,
    getEntityTabs: (kind) =>
      registry.getEntityTabs(kind).filter((tab) =>
        isEnabled(tabOwnership.get(tab.id), enabledIds, isLoading),
      ),
    getEntityCards: (kind) =>
      registry.getEntityCards(kind).filter((card) =>
        isEnabled(cardOwnership.get(card.id), enabledIds, isLoading),
      ),
    getRoutes: () =>
      registry.getRoutes().filter((route) =>
        isEnabled(routeOwnership.get(route.path), enabledIds, isLoading),
      ),
    getPluginConfig: (pluginId) => configs[pluginId] ?? {},
  }), [enabledIds, isLoading, configs]);

  return (
    <PluginContext.Provider value={value}>
      {children}
    </PluginContext.Provider>
  );
}

/**
 * Hook to access plugin-registered capabilities in any component under PluginProvider.
 */
export function usePlugins(): PluginContextValue {
  return useContext(PluginContext);
}
