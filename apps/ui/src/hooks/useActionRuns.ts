import { useQuery } from '@tanstack/react-query';
import { fetchActionRuns, type ActionRunFilters } from '../lib/templates.api.js';

export function useActionRuns(filters: ActionRunFilters = {}) {
  return useQuery({
    queryKey:        ['action-runs', filters],
    queryFn:         () => fetchActionRuns(filters),
    staleTime:       15_000,
    refetchInterval: 30_000,
  });
}
