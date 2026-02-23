import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import type { CurrentUser } from '../lib/types.js';

export function useCurrentUser() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<{ user: CurrentUser }>('/auth/me'),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
