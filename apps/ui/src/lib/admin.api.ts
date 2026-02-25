import { api } from './api.js';

export interface SetupStatus {
  scmConfigured:  boolean;
  oidcConfigured: boolean;
  authMode:       'oidc' | 'dev-bypass';
  entityCount:    number;
  templateCount:  number;
  version:        string;
}

export async function fetchSetupStatus(): Promise<SetupStatus> {
  const res = await api.get<{ data: SetupStatus }>('/admin/status');
  return res.data;
}
