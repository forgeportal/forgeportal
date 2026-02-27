export interface Entity {
  id: string;
  kind: string;
  namespace: string;
  name: string;
  description?: string;
  owner_ref: string | null;
  lifecycle: string | null;
  tags: string[];
  links: { title: string; url: string }[];
  annotations: Record<string, string>;
  scm: Record<string, unknown>;
  spec: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EntityRelation {
  id: string;
  from_entity_id: string;
  type: string;
  to_entity_id: string;
}

export interface EntitySource {
  id: string;
  entity_id: string;
  provider: string;
  repo_url: string;
  path: string;
  last_seen_at: string | null;
}

export interface EntityWithRelations {
  entity: Entity;
  relations: EntityRelation[];
  sources: EntitySource[];
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: { offset: number; limit: number; total: number };
}

export interface SearchResultItem {
  type: 'entity' | 'doc';
  id: string;
  title: string;
  excerpt: string;
  url: string;
  score: number;
  meta: Record<string, unknown>;
}

export interface SearchResponse {
  data: SearchResultItem[];
  pagination: { offset: number; limit: number; total: number };
  query: string;
  scope: string;
}

export interface CurrentUser {
  sub: string;
  email: string;
  name: string;
  role: string;
}

// ── Templates ──────────────────────────────────────────────────────────────

export interface TemplateParameter {
  id:           string;
  title:        string;
  type:         'string' | 'boolean' | 'number' | 'array';
  description?: string;
  default?:     unknown;
  enum?:        string[];
  pattern?:     string;
  required?:    boolean;
  ui?:          string;
  /** Hide this field unless the given sibling field equals the given value */
  dependsOn?:   Record<string, string>;
}

export interface TemplateSummary {
  id:          string;
  name:        string;
  version:     string;
  title:       string;
  description: string;
  tags?:       string[];
  parameters:  TemplateParameter[];
  steps?:      Array<{ id: string; action: string }>;
}

export interface TemplatesListResponse {
  data: { templates: TemplateSummary[] };
}

// ── Template Runs ──────────────────────────────────────────────────────────

export type RunStatus = 'queued' | 'running' | 'success' | 'failed' | 'canceled';

export interface TemplateRunStep {
  stepId:     string;
  actionId:   string | null;
  status:     RunStatus;
  outputs:    Record<string, unknown>;
  startedAt:  string | null;
  finishedAt: string | null;
}

export interface TemplateRunDetail {
  runId:       string;
  templateId:  string;
  requestedBy: string;
  status:      RunStatus;
  currentStep: string | null;
  steps:       TemplateRunStep[];
  outputs:     Record<string, unknown>;
  createdAt:   string;
  finishedAt:  string | null;
}

export interface TemplateRunResponse {
  data: TemplateRunDetail;
}

// ── Scorecards ─────────────────────────────────────────────────────────────

export interface FixActionSuggestion {
  actionId:        string;
  suggestedInputs: Record<string, unknown>;
}

export interface ScorecardRuleResult {
  ruleId:    string;
  ruleTitle: string;
  level:     string;
  pass:      boolean | null;    // null = not yet evaluated (pending)
  details:   Record<string, unknown>;
  error?:    string | null;
  fixAction: FixActionSuggestion | null;
}

export type ScorecardStatus = 'success' | 'failed' | 'partial' | 'pending';

export interface ScorecardEvaluation {
  scorecardId:     string;
  scorecardName:   string;
  version:         string;
  status:          ScorecardStatus;
  level:           string | null;
  evaluatedAt:     string | null;
  cacheTtlSeconds: number | null;
  rules:           ScorecardRuleResult[];
}

export interface EntityScorecardsResponse {
  data: {
    entityId:    string;
    evaluations: ScorecardEvaluation[];
  };
}

export interface ScorecardSummary {
  id:            string;
  name:          string;
  version:       string;
  appliesToKind: string;
  levels:        string[];
  rules: Array<{
    id:    string;
    title: string;
    level: string;
    type:  string;
  }>;
}

export interface ScorecardListResponse {
  data: { scorecards: ScorecardSummary[] };
}

export interface FixResponse {
  data: {
    templateRunId: string;
    statusUrl:     string;
    branch:        string;
    prTitle:       string;
  };
}

export interface ScorecardDashboard {
  totals: {
    Gold:   number;
    Silver: number;
    Bronze: number;
    none:   number;
    total:  number;
  };
  worst: Array<{
    entityId:   string;
    entityName: string;
    entityKind: string;
    level:      string | null;
  }>;
  byScorecardName: Array<{
    scorecardName:  string;
    appliesToKind:  string;
    levelBreakdown: Record<string, number>;
  }>;
}

export interface ScorecardDashboardResponse {
  data: ScorecardDashboard;
}

// ── Action Runs ────────────────────────────────────────────────────────────

export interface ActionRunSummary {
  id:            string;
  actionId:      string | null;
  stepId:        string | null;
  templateRunId: string | null;
  requestedBy:   string;
  status:        RunStatus;
  retryCount:    number;
  startedAt:     string | null;
  finishedAt:    string | null;
  createdAt:     string;
}

export interface ActionRunsResponse {
  data:       ActionRunSummary[];
  pagination: { limit: number; offset: number; total: number };
}

export interface EntityActionRunsResponse {
  data: { runs: ActionRunSummary[]; total: number };
}
