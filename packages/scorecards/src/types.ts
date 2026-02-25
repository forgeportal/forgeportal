// ── Scorecard definition (stored in scorecards.definition JSONB) ─────────────

export type RuleType =
  | 'entity.field.exists'
  | 'entity.link.exists'
  | 'scm.file.exists'
  | 'scm.anyOf';

export interface FieldExistsParams {
  field: string;              // entity field name: "owner_ref" | "lifecycle" | "tags" | ...
}

export interface LinkExistsParams {
  titleContains?: string;     // case-insensitive substring match on link.title
  urlContains?:   string;     // case-insensitive substring match on link.url
  urlStartsWith?: string;     // prefix match on link.url
}

export interface ScmFileExistsParams {
  path: string;               // file path relative to repo root, e.g. "README.md"
}

export interface ScmAnyOfParams {
  paths: string[];            // any of these paths must exist
}

export type RuleParams =
  | FieldExistsParams
  | LinkExistsParams
  | ScmFileExistsParams
  | ScmAnyOfParams;

export interface FixActionSuggestion {
  actionId:        string;                    // e.g., "scm.createOrUpdateFile@v1"
  suggestedInputs: Record<string, unknown>;   // pre-filled inputs for the action
}

export interface RuleDefinition {
  id:         string;         // unique within scorecard, e.g. "owner", "readme"
  title:      string;         // human-readable, e.g. "Owner is set"
  level:      string;         // "Bronze" | "Silver" | "Gold" (case-insensitive in engine)
  type:       RuleType;
  params:     RuleParams;
  fixAction?: FixActionSuggestion; // author-specified fix — takes priority over built-in resolver
}

export interface ScorecardDefinition {
  name:   string;
  levels: string[];           // ordered low → high, e.g. ["Bronze", "Silver", "Gold"]
  rules:  RuleDefinition[];
}

// ── Evaluation results ────────────────────────────────────────────────────────

export interface RuleResult {
  ruleId:    string;
  ruleTitle: string;
  level:     string;
  /**
   * `true`  = rule passed
   * `false` = rule failed
   * `null`  = rule skipped (SCM not configured for this entity) — treated as
   *           neutral by the level calculator (neither pass nor fail)
   */
  pass:      boolean | null;
  details:   Record<string, unknown>;
  error?:    string;          // set if rule evaluation threw
}

export type EvaluationStatus = 'success' | 'failed' | 'partial';

export interface EvaluationResult {
  evaluationId:    string;
  scorecardId:     string;
  entityId:        string;
  status:          EvaluationStatus;
  level:           string | null;
  results:         RuleResult[];
  cached:          boolean;
  evaluatedAt:     Date;
  cacheTtlSeconds: number;
}

/**
 * Minimal interface for starting a template run.
 * Implemented by TemplateOrchestrator from @forgeportal/scaffolder.
 * Defined here as an interface to avoid circular dependency:
 *   scaffolder → scorecards → scaffolder (FORBIDDEN)
 */
export interface ITemplateRunner {
  startTemplateRun(
    templateId:  string,
    requestedBy: string,
    userInputs:  Record<string, unknown>,
  ): Promise<{ id: string }>;
}

// ── DB rows ───────────────────────────────────────────────────────────────────

export interface ScorecardRow {
  id:              string;
  name:            string;
  applies_to_kind: string;
  version:         string;
  enabled:         boolean;
  definition:      ScorecardDefinition;
  created_at:      Date;
}

export interface EvaluationRow {
  id:                string;
  scorecard_id:      string;
  entity_id:         string;
  status:            EvaluationStatus;
  level:             string | null;
  results:           RuleResult[];
  evaluated_at:      Date;
  cache_ttl_seconds: number;
}
