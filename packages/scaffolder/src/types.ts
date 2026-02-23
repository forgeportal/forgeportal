export interface ActionResult {
  status: 'success' | 'failed';
  outputs: Record<string, unknown>;
  links?: { title: string; url: string }[];
  warnings?: string[];
  error?: string;
}

export type ActionErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTH_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'REMOTE_ERROR'
  | 'INTERNAL_ERROR';

export class ActionError extends Error {
  constructor(
    public readonly code: ActionErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ActionError';
  }
}

export interface ActionContext {
  runId: string;
  entityId: string | null;
  requestedBy: string;
  input: Record<string, unknown>;
  /** Acquire a session-level advisory lock on the given repo URL before SCM writes. */
  acquireRepoLock(repoUrl: string): Promise<void>;
  /** Append a structured log entry for this action run. */
  log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    meta?: Record<string, unknown>,
  ): Promise<void>;
}

export interface ActionHandler {
  /** e.g., "scm.createRepo@v1" */
  readonly actionId: string;
  execute(ctx: ActionContext): Promise<ActionResult>;
}
