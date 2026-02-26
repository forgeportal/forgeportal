// ─── ArgoCD API response shapes ──────────────────────────────────────────────

export interface ArgocdAppStatus {
  sync: {
    status:   'Synced' | 'OutOfSync' | 'Unknown';
    revision: string;
  };
  health: {
    status: 'Healthy' | 'Degraded' | 'Progressing' | 'Suspended' | 'Missing' | 'Unknown';
  };
  operationState?: {
    phase:     string;
    message?:  string;
    startedAt: string;
    finishedAt?: string;
  };
  reconciledAt?: string;
}

export interface ArgocdApp {
  metadata: {
    name:      string;
    namespace: string;
  };
  spec: {
    project: string;
    source?: {
      repoURL:        string;
      targetRevision: string;
      path?:          string;
    };
    destination: {
      server:    string;
      namespace: string;
    };
  };
  status: ArgocdAppStatus;
}

export interface ArgocdHistoryItem {
  id:         number;
  revision:   string;
  deployedAt: string;
  initiatedBy?: { username?: string; automated?: boolean };
}

export interface ArgocdResourceNode {
  kind:       string;
  name:       string;
  namespace?: string;
  status?:    string;
  health?:    { status: string };
}

export interface ArgocdResourceTree {
  nodes: ArgocdResourceNode[];
}

// ─── Plugin-internal config ───────────────────────────────────────────────────

export interface ArgocdConfig {
  url:      string;
  token:    string;
  insecure: boolean;
}
