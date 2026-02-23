import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { fetchEntities, type EntityFilters } from '../lib/catalog.api.js';

export function useEntities(filters: EntityFilters) {
  return useQuery({
    queryKey: ['entities', filters],
    queryFn: () => fetchEntities(filters),
    placeholderData: keepPreviousData,
  });
}
