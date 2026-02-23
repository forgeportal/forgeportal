import { useQuery } from '@tanstack/react-query';
import { fetchSearch } from '../lib/catalog.api.js';

export function useSearch(q: string, scope = 'all') {
  return useQuery({
    queryKey: ['search', q, scope],
    queryFn: () => fetchSearch(q, scope),
    enabled: q.length > 0,
  });
}
