import { useQuery } from '@tanstack/react-query';
import { fetchTemplate } from '../lib/templates.api.js';

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey:  ['template', id],
    queryFn:   () => fetchTemplate(id!),
    enabled:   !!id,
    staleTime: 60_000,
  });
}
