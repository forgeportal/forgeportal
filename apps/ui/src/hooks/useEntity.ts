import { useQuery } from '@tanstack/react-query';
import { fetchEntity } from '../lib/catalog.api.js';

export function useEntity(id: string) {
  return useQuery({
    queryKey: ['entity', id],
    queryFn: () => fetchEntity(id),
    enabled: !!id,
  });
}
