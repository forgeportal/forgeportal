import { useQuery } from '@tanstack/react-query';
import { fetchSetupStatus } from '../lib/admin.api.js';

export function useSetupStatus() {
  return useQuery({
    queryKey: ['admin', 'setup-status'],
    queryFn: fetchSetupStatus,
    staleTime: 30_000,
    retry: false,
  });
}
