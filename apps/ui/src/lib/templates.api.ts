import { api } from './api.js';
import type {
  TemplatesListResponse,
  TemplateSummary,
  TemplateRunResponse,
  ActionRunsResponse,
} from './types.js';

export async function fetchTemplates(): Promise<TemplateSummary[]> {
  const res = await api.get<TemplatesListResponse>('/templates');
  return res.data.templates;
}

export async function fetchTemplate(id: string): Promise<TemplateSummary> {
  const res = await api.get<{ data: TemplateSummary }>(`/templates/${id}`);
  return res.data;
}

export async function runTemplate(
  templateId: string,
  inputs: Record<string, unknown>,
  csrfToken: string,
): Promise<{ runId: string }> {
  const res = await api.post<{ data: { runId: string; status: string } }>(
    '/templates/run',
    { templateId, inputs },
    { 'X-CSRF-Token': csrfToken },
  );
  return { runId: res.data.runId };
}

export async function fetchTemplateRun(runId: string): Promise<TemplateRunResponse> {
  return api.get<TemplateRunResponse>(`/templates/runs/${runId}`);
}

export interface ActionRunFilters {
  status?: string;
  limit?:  number;
  offset?: number;
}

export async function fetchActionRuns(filters: ActionRunFilters = {}): Promise<ActionRunsResponse> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.limit)  params.set('limit', String(filters.limit));
  if (filters.offset) params.set('offset', String(filters.offset));
  const qs = params.toString();
  return api.get<ActionRunsResponse>(`/action-runs${qs ? `?${qs}` : ''}`);
}
