import { z } from 'zod';
import type { ActionHandler, ActionContext, ActionResult } from '../../types.js';
import { ActionError } from '../../types.js';
import type { SCMProviders } from '@forgeportal/scm';
import { buildRepoUrl, mapScmError } from '../scm/scm-error-mapper.js';

// Helm templates use Go template syntax ({{ }}) — stored as raw strings
function helmDeploymentTemplate(name: string, port: number): string {
  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}-{{ .Chart.Name }}
  labels:
    app: {{ .Chart.Name }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Chart.Name }}
  template:
    metadata:
      labels:
        app: {{ .Chart.Name }}
    spec:
      containers:
        - name: {{ .Chart.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          ports:
            - containerPort: ${port}
`;
}

function helmServiceTemplate(name: string, port: number): string {
  return `apiVersion: v1
kind: Service
metadata:
  name: {{ .Release.Name }}-{{ .Chart.Name }}
spec:
  type: {{ .Values.service.type }}
  ports:
    - port: {{ .Values.service.port }}
      targetPort: ${port}
  selector:
    app: {{ .Chart.Name }}
`;
}

function helmFiles(name: string, port: number): Array<{ path: string; content: string }> {
  return [
    {
      path: `charts/${name}/Chart.yaml`,
      content: `apiVersion: v2\nname: ${name}\ndescription: Helm chart for ${name}\ntype: application\nversion: 0.1.0\nappVersion: "1.0.0"\n`,
    },
    {
      path: `charts/${name}/values.yaml`,
      content: `replicaCount: 1\nimage:\n  repository: your-registry/${name}\n  tag: latest\nservice:\n  type: ClusterIP\n  port: ${port}\n`,
    },
    {
      path: `charts/${name}/templates/deployment.yaml`,
      content: helmDeploymentTemplate(name, port),
    },
    {
      path: `charts/${name}/templates/service.yaml`,
      content: helmServiceTemplate(name, port),
    },
  ];
}

function manifestFiles(
  name: string,
  namespace: string,
  port: number,
  image: string,
  replicas: number,
): Array<{ path: string; content: string }> {
  return [
    {
      path: 'k8s/deployment.yaml',
      content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  replicas: ${replicas}
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
        - name: ${name}
          image: ${image}
          ports:
            - containerPort: ${port}
`,
    },
    {
      path: 'k8s/service.yaml',
      content: `apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  selector:
    app: ${name}
  ports:
    - protocol: TCP
      port: ${port}
      targetPort: ${port}
  type: ClusterIP
`,
    },
  ];
}

const k8sBootstrapInputSchema = z.object({
  provider: z.enum(['github', 'gitlab']),
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().default('main'),
  mode: z.enum(['manifests', 'helm']),
  name: z.string().min(1),
  namespace: z.string().default('default'),
  servicePort: z.number().int().default(8080),
  image: z.string().default('your-registry/your-image:latest'),
  replicas: z.number().int().min(1).default(1),
});

export class K8sBootstrapHandler implements ActionHandler {
  readonly actionId = 'k8s.bootstrap@v1';

  constructor(private readonly scmProviders: SCMProviders) {}

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const parsed = k8sBootstrapInputSchema.safeParse(ctx.input);
    if (!parsed.success) {
      throw new ActionError('VALIDATION_ERROR', parsed.error.message);
    }
    const { provider, owner, repo, branch, mode, name, namespace, servicePort, image, replicas } =
      parsed.data;

    const scm = this.scmProviders.get(provider);
    if (!scm) throw new ActionError('AUTH_ERROR', `SCM provider not configured: ${provider}`);

    const ref = { owner, repo };
    const repoUrl = buildRepoUrl(provider, owner, repo);
    const files =
      mode === 'helm'
        ? helmFiles(name, servicePort)
        : manifestFiles(name, namespace, servicePort, image, replicas);

    await ctx.acquireRepoLock(repoUrl);
    await ctx.log('info', `Bootstrapping K8s (${mode}) for ${name} in ${repoUrl}`);

    const writtenFiles: string[] = [];
    const skippedFiles: string[] = [];

    for (const file of files) {
      try {
        const existing = await scm.getFile(ref, file.path, branch);
        if (existing && existing.content === file.content) {
          skippedFiles.push(file.path);
          await ctx.log('debug', `Skipping unchanged file: ${file.path}`);
          continue;
        }
        await scm.createOrUpdateFile(
          ref,
          file.path,
          file.content,
          `k8s: bootstrap ${mode} files for ${name}`,
          branch,
          existing?.sha,
        );
        writtenFiles.push(file.path);
        await ctx.log('info', `Written: ${file.path}`);
      } catch (err) {
        throw mapScmError(err, `createOrUpdateFile (${file.path})`);
      }
    }

    const warnings: string[] = [];
    if (skippedFiles.length > 0) {
      warnings.push(`${skippedFiles.length} file(s) unchanged and skipped`);
    }

    const outputPath = mode === 'helm' ? `charts/${name}/` : 'k8s/';

    return {
      status: 'success',
      outputs: { path: outputPath, writtenFiles },
      links: [],
      warnings,
    };
  }
}
