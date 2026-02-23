import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api.js';
import Spinner from '../../components/Spinner.js';
import ErrorMessage from '../../components/ErrorMessage.js';

interface PermissionRow {
  id: string;
  subject_ref: string;
  role: string;
  scope: Record<string, unknown>;
  created_at: string;
}

interface RolesResponse {
  data: Record<string, string[]>;
}

export default function AdminPermissionsPage() {
  const queryClient = useQueryClient();
  const [subjectRef, setSubjectRef] = useState('');
  const [role, setRole] = useState('');
  const [scopeTeams, setScopeTeams] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ['admin-permissions'],
    queryFn: () => api.get<{ data: PermissionRow[] }>('/admin/permissions'),
  });

  const { data: rolesData } = useQuery({
    queryKey: ['admin-permissions-roles'],
    queryFn: () => api.get<RolesResponse>('/admin/permissions/roles'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/permissions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-permissions'] }),
  });

  const addMutation = useMutation({
    mutationFn: (body: { subjectRef: string; role: string; scope?: Record<string, unknown> }) =>
      api.post<{ data: PermissionRow }>('/admin/permissions', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-permissions'] });
      setSubjectRef('');
      setRole('');
      setScopeTeams('');
      setFormError(null);
    },
    onError: (err: Error & { status?: number }) => {
      setFormError(err.message ?? 'Erreur lors de l’ajout');
    },
  });

  const roles = rolesData?.data ?? {};
  const roleNames = Object.keys(roles);
  const permissions = listData?.data ?? [];

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!subjectRef.trim() || !role) {
      setFormError('subject_ref et rôle sont requis.');
      return;
    }
    const ref = subjectRef.trim();
    if (!ref.startsWith('user:') && !ref.startsWith('team:')) {
      setFormError('subject_ref doit commencer par user: ou team:');
      return;
    }
    const scope: Record<string, unknown> = {};
    if (scopeTeams.trim()) scope.teams = scopeTeams.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    addMutation.mutate({ subjectRef: ref, role, scope: Object.keys(scope).length ? scope : undefined });
  };

  if (listLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Ajouter une permission</h2>
        <form onSubmit={handleAdd} className="mt-4 space-y-3 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700">subject_ref</label>
            <input
              type="text"
              value={subjectRef}
              onChange={(e) => setSubjectRef(e.target.value)}
              placeholder="user:email@example.com ou team:slug"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Rôle</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— Choisir —</option>
              {roleNames.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Scope teams (optionnel, séparés par des virgules)</label>
            <input
              type="text"
              value={scopeTeams}
              onChange={(e) => setScopeTeams(e.target.value)}
              placeholder="backend, frontend"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          {formError && <ErrorMessage message={formError} />}
          <button
            type="submit"
            disabled={addMutation.isPending}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {addMutation.isPending ? 'Ajout…' : 'Ajouter'}
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <h2 className="px-6 py-4 text-lg font-semibold text-gray-900 border-b border-gray-100">Permissions</h2>
        {permissions.length === 0 ? (
          <p className="px-6 py-4 text-sm text-gray-500">Aucune permission.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">subject_ref</th>
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">Rôle</th>
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">Scope</th>
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">Créé le</th>
                <th className="px-6 py-2 text-right text-xs font-medium text-gray-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {permissions.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm font-mono text-gray-800">{p.subject_ref}</td>
                  <td className="px-6 py-3 text-sm text-gray-800">{p.role}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {p.scope && Object.keys(p.scope).length > 0
                      ? JSON.stringify(p.scope)
                      : '—'}
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-500">
                    {p.created_at ? new Date(p.created_at).toLocaleString() : '—'}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(p.id)}
                      disabled={deleteMutation.isPending}
                      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      Supprimer
                    </button>
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
