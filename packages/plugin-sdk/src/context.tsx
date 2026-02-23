import React, { createContext, useContext } from 'react';
import type { Entity } from './types.js';

// ─── EntityContext ───────────────────────────────────────────────────────────

interface EntityContextValue {
  entity: Entity;
}

export const EntityContext = createContext<EntityContextValue | null>(null);

export function EntityProvider({
  entity,
  children,
}: {
  entity:   Entity;
  children: React.ReactNode;
}) {
  return (
    <EntityContext.Provider value={{ entity }}>
      {children}
    </EntityContext.Provider>
  );
}

// ─── PluginConfigContext ──────────────────────────────────────────────────────

interface PluginConfigContextValue {
  get<T = unknown>(key: string): T | undefined;
}

const defaultConfig: PluginConfigContextValue = {
  get: () => undefined,
};

export const PluginConfigContext = createContext<PluginConfigContextValue>(defaultConfig);

export function PluginConfigProvider({
  config,
  children,
}: {
  config:   Record<string, unknown>;
  children: React.ReactNode;
}) {
  const accessor: PluginConfigContextValue = {
    get: <T = unknown>(key: string) => config[key] as T | undefined,
  };
  return (
    <PluginConfigContext.Provider value={accessor}>
      {children}
    </PluginConfigContext.Provider>
  );
}

/** @internal Used by useEntity hook */
export function useEntityContext(): EntityContextValue | null {
  return useContext(EntityContext);
}

/** @internal Used by useConfig hook */
export function usePluginConfigContext(): PluginConfigContextValue {
  return useContext(PluginConfigContext);
}
