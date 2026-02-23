import { api } from './api.js';
import type {
  EntityScorecardsResponse,
  ScorecardListResponse,
  FixResponse,
  ScorecardDashboardResponse,
} from './types.js';

export function fetchEntityScorecards(entityId: string): Promise<EntityScorecardsResponse> {
  return api.get<EntityScorecardsResponse>(`/scorecards/${entityId}/latest`);
}

export function fetchAllScorecards(kind?: string): Promise<ScorecardListResponse> {
  const qs = kind ? `?kind=${encodeURIComponent(kind)}` : '';
  return api.get<ScorecardListResponse>(`/scorecards${qs}`);
}

export async function triggerFix(
  entityId:    string,
  scorecardId: string,
  ruleId:      string,
  csrfToken:   string,
): Promise<FixResponse> {
  return api.post<FixResponse>(
    `/scorecards/${entityId}/fix`,
    { scorecardId, ruleId },
    { 'X-CSRF-Token': csrfToken },
  );
}

export async function triggerEvaluate(
  entityId:  string,
  csrfToken: string,
): Promise<{ data: { jobsEnqueued: number } }> {
  return api.post(
    `/scorecards/${entityId}/evaluate`,
    { force: true },
    { 'X-CSRF-Token': csrfToken },
  );
}

export function fetchScorecardDashboard(): Promise<ScorecardDashboardResponse> {
  return api.get<ScorecardDashboardResponse>('/scorecards/dashboard');
}
