// ─── Cluster config ──────────────────────────────────────────────────────────

export interface ClusterConfig {
  name:          string;
  url:           string;
  /** Service-account token. Sourced from FORGEPORTAL_PLUGIN_KUBERNETES_<NAME>_TOKEN. */
  token:         string;
  skipTLSVerify: boolean;
}

// ─── Normalised K8s resource types returned by the plugin API ────────────────

export interface K8sDeployment {
  name:        string;
  namespace:   string;
  replicas:    { desired: number; ready: number; available: number };
  image:       string;
  lastRollout: string | null;
  healthy:     boolean;
}

export interface K8sPod {
  name:       string;
  namespace:  string;
  /** e.g. "Running" | "Pending" | "CrashLoopBackOff" | "Completed" */
  status:     string;
  ready:      boolean;
  containers: number;
  nodeName:   string | null;
  startTime:  string | null;
}

export interface K8sService {
  name:      string;
  namespace: string;
  type:      string;
  clusterIp: string;
  ports:     Array<{ port: number; protocol: string; targetPort: string | number }>;
}

export interface K8sIngress {
  name:      string;
  namespace: string;
  hosts:     string[];
  tls:       boolean;
}

export interface WorkloadsResponse {
  cluster:       string;
  namespace:     string;
  labelSelector: string;
  deployments:   K8sDeployment[];
  pods:          K8sPod[];
  services:      K8sService[];
  ingresses:     K8sIngress[];
}

// ─── Raw K8s API shapes (minimal subset) ─────────────────────────────────────

export interface RawDeployment {
  metadata: { name: string; namespace: string; creationTimestamp?: string };
  spec:     {
    replicas?: number;
    template: { spec: { containers: Array<{ image?: string }> } };
  };
  status?: {
    replicas?:          number;
    readyReplicas?:     number;
    availableReplicas?: number;
    conditions?:        Array<{ type: string; status: string; lastUpdateTime?: string }>;
  };
}

export interface RawPod {
  metadata: { name: string; namespace: string };
  spec?:    { nodeName?: string; containers?: Array<{ name: string }> };
  status?:  {
    phase?:             string;
    startTime?:         string;
    conditions?:        Array<{ type: string; status: string }>;
    containerStatuses?: Array<{
      ready?: boolean;
      state?: { waiting?: { reason?: string } };
    }>;
  };
}

export interface RawService {
  metadata: { name: string; namespace: string };
  spec?: {
    type?:      string;
    clusterIP?: string;
    ports?:     Array<{ port: number; protocol?: string; targetPort?: string | number }>;
  };
}

export interface RawIngress {
  metadata: { name: string; namespace: string };
  spec?: {
    tls?:   unknown[];
    rules?: Array<{ host?: string }>;
  };
}
