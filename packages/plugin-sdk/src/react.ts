/**
 * React hooks and context providers for use inside plugin UI components
 * and the ForgePortal UI app shell.
 * Import from: @forgeportal/plugin-sdk/react
 */
import { useCallback } from 'react';
import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { useEntityContext, usePluginConfigContext } from './context.js';
import type { Entity } from './types.js';

// ─── Re-export React context providers for the app shell ─────────────────────
// These are used by EntityDetailPage and EntityOverviewTab to wrap plugin components.
export {
  EntityProvider,
  EntityContext,
  PluginConfigProvider,
  PluginConfigContext,
} from './context.js';

/**
 * Returns the current entity from the entity detail page context.
 * Must be used inside a component rendered as an EntityTab or EntityCard.
 *
 * @throws if called outside of an EntityProvider.
 */
export function useEntity(): { entity: Entity } {
  const ctx = useEntityContext();
  if (!ctx) {
    throw new Error(
      '[ForgePortal SDK] useEntity() must be called inside an EntityTab or EntityCard component. ' +
      'Ensure this component is registered via sdk.registerEntityTab() or sdk.registerEntityCard().',
    );
  }
  return ctx;
}

/**
 * Returns the plugin-scoped config value for the given key.
 * Config is sourced from `forgeportal.yaml` -> `plugins.<pluginId>.config`.
 *
 * @example
 * const apiUrl = useConfig<string>('apiEndpoint');
 */
export function useConfig<T = unknown>(key: string): T | undefined {
  const config = usePluginConfigContext();
  return config.get<T>(key);
}

/**
 * Typed API fetcher backed by TanStack Query.
 * Automatically includes credentials for session-based auth.
 *
 * @param path    - Absolute API path, e.g. '/api/v1/entities'
 * @param options - Optional TanStack Query options to override defaults
 *
 * @example
 * const { data, isPending } = useApi<MyResponse[]>('/api/v1/my-plugin/data');
 */
export function useApi<TData = unknown>(
  path: string,
  options?: Omit<UseQueryOptions<TData>, 'queryKey' | 'queryFn'>,
): UseQueryResult<TData, Error> {
  const queryFn = useCallback(async (): Promise<TData> => {
    const res = await fetch(path, {
      headers:     { 'Accept': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`[ForgePortal SDK] API ${path} returned ${res.status}: ${text}`);
    }
    return res.json() as Promise<TData>;
  }, [path]);

  return useQuery<TData, Error>({
    queryKey: ['forge-plugin-api', path],
    queryFn,
    ...options,
  });
}
