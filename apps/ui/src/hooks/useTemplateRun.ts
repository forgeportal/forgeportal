import { useQuery } from '@tanstack/react-query';
import { fetchTemplateRun } from '../lib/templates.api.js';

export function useTemplateRun(runId: string | undefined) {
  return useQuery({
    queryKey: ['template-run', runId],
    queryFn:  () => fetchTemplateRun(runId!).then((r) => r.data),
    enabled:  !!runId,
    staleTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'running' || status === 'queued' ? 2_000 : false;
    },
  });
}
