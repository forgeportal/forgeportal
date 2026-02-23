import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api.js';
import Spinner from '../../components/Spinner.js';
import ErrorMessage from '../../components/ErrorMessage.js';

interface ScanJob {
  id: string;
  type: string;
  status: string;
  created_at: string;
  finished_at?: string | null;
  payload?: Record<string, unknown>;
}

export default function AdminScanPage() {
  const queryClient = useQueryClient();
  const [org, setOrg] = useState('');

  const { isLoading: statusLoading } = useQuery({
    queryKey: ['admin-scan-status'],
    queryFn: () => api.get<{ job: ScanJob | null }>('/admin/scan/status'),
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['admin-scan-jobs'],
    queryFn: () => api.get<{ data: ScanJob[] }>('/admin/scan/jobs?limit=20'),
  });

  const triggerMutation = useMutation({
    mutationFn: (body: { org?: string }) => api.post<{ jobId: string; status: string }>('/admin/scan', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-scan-status'] });
      queryClient.invalidateQueries({ queryKey: ['admin-scan-jobs'] });
    },
  });

  const jobs = jobsData?.data ?? [];

  const handleTrigger = (e: React.FormEvent) => {
    e.preventDefault();
    triggerMutation.mutate(org.trim() ? { org: org.trim() } : {});
  };

  if (statusLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Lancer un scan</h2>
        <form onSubmit={handleTrigger} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Org (optionnel)</label>
            <input
              type="text"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              placeholder="my-org"
              className="mt-1 block w-48 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={triggerMutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {triggerMutation.isPending ? 'Envoi…' : 'Lancer le scan'}
          </button>
        </form>
        {triggerMutation.isError && (
          <ErrorMessage message={(triggerMutation.error as Error).message} />
        )}
        {triggerMutation.isSuccess && (
          <p className="mt-2 text-sm text-green-600">Scan enqueued (jobId: {(triggerMutation.data as { jobId: string }).jobId}).</p>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <h2 className="px-6 py-4 text-lg font-semibold text-gray-900 border-b border-gray-100">Historique des scans (repo-scan)</h2>
        {jobsLoading ? (
          <div className="flex justify-center py-8"><Spinner size="sm" /></div>
        ) : jobs.length === 0 ? (
          <p className="px-6 py-4 text-sm text-gray-500">Aucun job repo-scan.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">ID</th>
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">Statut</th>
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">Créé le</th>
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">Terminé le</th>
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {jobs.map((j) => (
                <tr key={j.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-mono text-gray-800">{j.id}</td>
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        j.status === 'success' ? 'bg-green-100 text-green-800' :
                        j.status === 'failed' ? 'bg-red-100 text-red-800' :
                        j.status === 'running' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {j.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {new Date(j.created_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {j.finished_at ? new Date(j.finished_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-500 font-mono">
                    {j.payload && Object.keys(j.payload).length > 0 ? JSON.stringify(j.payload) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
