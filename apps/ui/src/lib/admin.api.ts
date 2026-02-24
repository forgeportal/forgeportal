import { api } from './api.js';

export interface SetupStatus {
  scmConfigured: boolean;
  entityCount: number;
  templateCount: number;
}

export async function fetchSetupStatus(): Promise<SetupStatus> {
  const res = await api.get<{ data: SetupStatus }>('/admin/status');
  return res.data;
}
