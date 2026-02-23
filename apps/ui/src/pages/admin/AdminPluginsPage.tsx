import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import Spinner from '../../components/Spinner.js';
import ErrorMessage from '../../components/ErrorMessage.js';

interface PluginItem {
  id: string;
  name?: string;
  version?: string;
  status: string;
  [key: string]: unknown;
}

export default function AdminPluginsPage() {
  const queryClient = useQueryClient();

  const { data: plugins, isLoading } = useQuery({
    queryKey: ['admin-plugins'],
    queryFn: () => api.get<PluginItem[]>('/plugins'),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch<{ id: string; enabled: boolean; message: string }>(`/admin/plugins/${id}`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-plugins'] });
    },
  });

  const list = Array.isArray(plugins) ? plugins : [];

  const handleToggle = (p: PluginItem) => {
    const nextEnabled = p.status !== 'enabled';
    patchMutation.mutate({ id: p.id, enabled: nextEnabled });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <h2 className="px-6 py-4 text-lg font-semibold text-gray-900 border-b border-gray-100">Plugins</h2>
      {patchMutation.isError && (
        <div className="px-6 py-2">
          <ErrorMessage message={(patchMutation.error as Error).message} />
        </div>
      )}
      <p className="px-6 py-2 text-xs text-gray-500 border-b border-gray-100">
        Un redémarrage du serveur est nécessaire pour que l’activation/désactivation prenne effet.
      </p>
      {list.length === 0 ? (
        <p className="px-6 py-4 text-sm text-gray-500">Aucun plugin chargé.</p>
      ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">ID</th>
              <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">Nom</th>
              <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">Version</th>
              <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">Statut</th>
              <th className="px-6 py-2 text-right text-xs font-medium text-gray-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {list.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm font-mono text-gray-800">{p.id}</td>
                <td className="px-6 py-3 text-sm text-gray-800">{p.name ?? '—'}</td>
                <td className="px-6 py-3 text-sm text-gray-600">{p.version ?? '—'}</td>
                <td className="px-6 py-3">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === 'enabled' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {p.status ?? 'unknown'}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleToggle(p)}
                    disabled={patchMutation.isPending}
                    className="text-sm font-medium text-indigo-600 hover:text-indigo-500 disabled:opacity-50"
                  >
                    {p.status === 'enabled' ? 'Désactiver' : 'Activer'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
