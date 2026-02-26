import type {
  ArgocdApp,
  ArgocdHistoryItem,
  ArgocdConfig,
  ArgocdResourceTree,
} from './types.js';

/**
 * Thin HTTP client for the ArgoCD REST API v1.
 * Authenticates with a Bearer token (service-account or user token).
 */
export class ArgocdApiClient {
  private readonly baseUrl: string;
  private readonly token:   string;
  private readonly rejectUnauthorized: boolean;

  constructor(config: ArgocdConfig) {
    this.baseUrl             = config.url.replace(/\/$/, '');
    this.token               = config.token;
    this.rejectUnauthorized  = !config.insecure;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const res = await (fetch as (url: string, init: Record<string, unknown>) => Promise<Response>)(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`ArgoCD API ${res.status}: ${body || res.statusText}`);
    }

    return res.json() as Promise<T>;
  }

  /**
   * GET /api/v1/applications/{appName}
   */
  async getApp(appName: string): Promise<ArgocdApp> {
    return this.request<ArgocdApp>(`/applications/${encodeURIComponent(appName)}`);
  }

  /**
   * GET /api/v1/applications/{appName}/revisions
   * Returns the last 10 sync history entries.
   */
  async getHistory(appName: string): Promise<ArgocdHistoryItem[]> {
    const app = await this.getApp(appName);
    // History is embedded in the application status
    const history = (app as unknown as { status: { history?: ArgocdHistoryItem[] } })
      .status?.history ?? [];
    return history.slice(-10).reverse();
  }

  /**
   * GET /api/v1/applications/{appName}/resource-tree
   */
  async getResourceTree(appName: string): Promise<ArgocdResourceTree> {
    return this.request<ArgocdResourceTree>(
      `/applications/${encodeURIComponent(appName)}/resource-tree`,
    );
  }

  /**
   * POST /api/v1/applications/{appName}/sync
   */
  async syncApp(appName: string): Promise<void> {
    await this.request(`/applications/${encodeURIComponent(appName)}/sync`, {
      method: 'POST',
      body:   JSON.stringify({}),
    });
  }

  /**
   * POST /api/v1/applications/{appName}/rollback
   * Rolls back to a specific history entry by id.
   */
  async rollbackApp(appName: string, historyId: number): Promise<void> {
    await this.request(`/applications/${encodeURIComponent(appName)}/rollback`, {
      method: 'POST',
      body:   JSON.stringify({ id: historyId }),
    });
  }
}
