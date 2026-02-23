import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../lib/api.js';
import Spinner from '../../components/Spinner.js';
import ErrorMessage from '../../components/ErrorMessage.js';

type Provider = 'github' | 'gitlab';

interface Integration {
  id: string;
  provider: Provider;
  name: string;
  baseUrl: string | null;
  appId: string | null;
  config: Record<string, string>;
  storedSecrets: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  provider: Provider;
  name: string;
  baseUrl: string;
  appId: string;
  token: string;
  webhookSecret: string;
  privateKey: string;
  storedSecrets: Record<string, boolean>;
}

const emptyForm = (): FormState => ({
  provider: 'github',
  name: '',
  baseUrl: '',
  appId: '',
  token: '',
  webhookSecret: '',
  privateKey: '',
  storedSecrets: {},
});

const PROVIDER_LABELS: Record<Provider, string> = {
  github: 'GitHub',
  gitlab: 'GitLab',
};

function buildPayload(form: FormState, isEdit: boolean) {
  const secrets: Record<string, string> = {};
  if (form.token) secrets['token'] = form.token;
  if (form.webhookSecret) secrets['webhookSecret'] = form.webhookSecret;
  if (form.provider === 'github' && form.privateKey) secrets['privateKey'] = form.privateKey;

  const payload: Record<string, unknown> = {
    provider: form.provider,
    name: form.name,
  };
  if (form.baseUrl) payload.baseUrl = form.baseUrl;
  if (form.appId) payload.appId = form.appId;
  // Only include secrets object if there is something to send (on edit, empty means unchanged)
  if (!isEdit || Object.keys(secrets).length > 0) {
    payload.secrets = secrets;
  }
  return payload;
}

export default function AdminIntegrationsPage() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-integrations'],
    queryFn: () => api.get<{ data: Integration[] }>('/admin/integrations'),
  });

  const integrations = data?.data ?? [];

  const createMutation = useMutation({
    mutationFn: (body: unknown) =>
      api.post<{ data: Integration }>('/admin/integrations', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-integrations'] });
      closeForm();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      api.patch<{ data: Integration }>(`/admin/integrations/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-integrations'] });
      closeForm();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/integrations/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-integrations'] }),
  });

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (itg: Integration) => {
    setEditId(itg.id);
    setForm({
      provider: itg.provider,
      name: itg.name,
      baseUrl: itg.baseUrl ?? '',
      appId: itg.appId ?? '',
      token: '',
      webhookSecret: '',
      privateKey: '',
      storedSecrets: itg.storedSecrets,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditId(null);
    setForm(emptyForm());
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim()) {
      setFormError('Le nom est requis.');
      return;
    }
    const payload = buildPayload(form, editId !== null);
    if (editId) {
      updateMutation.mutate({ id: editId, body: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Integrations SCM</h2>
        <button
          type="button"
          onClick={openAdd}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Ajouter
        </button>
      </div>

      {formOpen && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-6">
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            {editId ? "Modifier l'intégration" : 'Nouvelle intégration'}
          </h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Provider</label>
              <select
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value as Provider })}
                disabled={editId !== null}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Nom *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="production-github"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Base URL</label>
              <input
                type="url"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder={form.provider === 'gitlab' ? 'https://gitlab.example.com' : undefined}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            {form.provider === 'github' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">App ID</label>
                <input
                  type="text"
                  value={form.appId}
                  onChange={(e) => setForm({ ...form, appId: e.target.value })}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            )}

            {/* Secret fields */}
            <div className="sm:col-span-2 border-t border-indigo-200 pt-4">
              <p className="mb-3 text-xs italic text-gray-500">
                {editId
                  ? 'Laissez les champs secrets vides pour conserver les valeurs actuelles.'
                  : 'Les secrets sont chiffrés au repos et ne sont jamais renvoyés par l\u2019API.'}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Token{' '}
                    {form.storedSecrets['token'] && (
                      <span className="text-xs font-normal text-green-700">(stocké ✓)</span>
                    )}
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={form.token}
                    onChange={(e) => setForm({ ...form, token: e.target.value })}
                    placeholder={editId ? '(inchangé)' : 'ghp_…'}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Webhook Secret{' '}
                    {form.storedSecrets['webhookSecret'] && (
                      <span className="text-xs font-normal text-green-700">(stocké ✓)</span>
                    )}
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={form.webhookSecret}
                    onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
                    placeholder={editId ? '(inchangé)' : undefined}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                {form.provider === 'github' && (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Private Key (GitHub App){' '}
                      {form.storedSecrets['privateKey'] && (
                        <span className="text-xs font-normal text-green-700">(stocké ✓)</span>
                      )}
                    </label>
                    <textarea
                      rows={3}
                      autoComplete="off"
                      value={form.privateKey}
                      onChange={(e) => setForm({ ...form, privateKey: e.target.value })}
                      placeholder={editId ? '(inchangé)' : '-----BEGIN RSA PRIVATE KEY-----\u2026'}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono text-xs"
                    />
                  </div>
                )}
              </div>
            </div>

            {formError && (
              <div className="sm:col-span-2">
                <ErrorMessage message={formError} />
              </div>
            )}

            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {isPending ? 'Enregistrement\u2026' : editId ? 'Mettre à jour' : 'Créer'}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        {integrations.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-gray-500">
            Aucune intégration configurée. Cliquez sur « Ajouter » pour en créer une.
          </p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">Provider</th>
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">Nom</th>
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">Base URL</th>
                <th className="px-6 py-2 text-left text-xs font-medium text-gray-500">Secrets</th>
                <th className="px-6 py-2 text-right text-xs font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {integrations.map((itg) => (
                <tr key={itg.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        itg.provider === 'github'
                          ? 'bg-gray-900 text-white'
                          : 'bg-orange-100 text-orange-800'
                      }`}
                    >
                      {PROVIDER_LABELS[itg.provider]}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900">{itg.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-500">{itg.baseUrl ?? '—'}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">
                    {Object.keys(itg.storedSecrets).length > 0 ? (
                      Object.keys(itg.storedSecrets).map((f) => (
                        <span
                          key={f}
                          className="mr-1 inline-flex rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-800"
                        >
                          {f} ✓
                        </span>
                      ))
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-6 py-3 text-right space-x-3">
                    <button
                      type="button"
                      onClick={() => openEdit(itg)}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Supprimer l'intégration "${itg.name}" ?`)) {
                          deleteMutation.mutate(itg.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className="text-sm font-medium text-red-600 hover:text-red-500 disabled:opacity-50"
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
