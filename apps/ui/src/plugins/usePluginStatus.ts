import { useQuery } from '@tanstack/react-query';

interface PluginStatusResponse {
  enabledIds: string[];
  /** Non-secret public config per plugin ID, delivered by the backend. */
  configs:    Record<string, Record<string, unknown>>;
}

/**
 * Fetches the list of enabled plugin IDs and their public configs from the backend.
 * Refetches every 5 minutes to pick up runtime changes.
 * Returns empty list on error (graceful degradation — all plugins visible).
 */
export function usePluginStatus() {
  return useQuery<PluginStatusResponse, Error>({
    queryKey: ['plugin-status'],
    queryFn:  async () => {
      const res = await fetch('/api/v1/plugins/status', {
        credentials: 'include',
        headers:     { Accept: 'application/json' },
      });
      if (!res.ok) {
        // Graceful degradation: if we can't fetch status, show all plugins
        return { enabledIds: [], configs: {} };
      }
      return res.json() as Promise<PluginStatusResponse>;
    },
    staleTime:       5 * 60 * 1000, // 5 minutes
    placeholderData: { enabledIds: [], configs: {} },
  });
}
