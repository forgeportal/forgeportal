import { useQuery } from '@tanstack/react-query';
import { fetchTemplates } from '../lib/templates.api.js';

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn:  fetchTemplates,
    staleTime: 60_000,
  });
}
