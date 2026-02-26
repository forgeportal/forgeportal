//
// Static plugin registrations for the UI shell.
//
// To install a UI plugin:
//   1. pnpm add @myorg/forge-plugin-myplugin
//   2. Add: import { registerPlugin as registerMyPlugin } from '@myorg/forge-plugin-myplugin';
//            registerPluginById('myplugin', registerMyPlugin);
//   3. Rebuild UI Docker image.
//
// The plugin ID here MUST match the ID derived by the backend loader
// (last segment of package name after "forge-plugin-").
// See: apps/api/src/plugins/plugin-loader.ts — derivePluginId()
//

import { registerPluginById } from './plugin-registry-ui.js';
import { registerPlugin as registerKubernetes }      from '@forgeportal/plugin-kubernetes/ui';
import { registerPlugin as registerArgocd }          from '@forgeportal/plugin-argocd/ui';
import { registerPlugin as registerGitHubInsights }  from '@forgeportal/plugin-github-insights/ui';
import { registerPlugin as registerGrafana }         from '@forgeportal/plugin-grafana/ui';

// ── Installed plugins ─────────────────────────────────────────────────────────

// Kubernetes plugin — shows live Deployments, Pods, Services, and Ingresses
// for entities that have the annotation forgeportal.dev/k8s-label-selector.
// Configure clusters in forgeportal.yaml → plugins.kubernetes.config.clusters.
registerPluginById('kubernetes', registerKubernetes);

// ArgoCD plugin — shows sync status, health, revision, and sync history
// for entities that have the annotation forgeportal.dev/argocd-app-name.
// Configure server URL in forgeportal.yaml → plugins.argocd.config.url.
registerPluginById('argocd', registerArgocd);

// GitHub Insights plugin — shows open PRs, recent commits, contributors, and
// repository stats for any entity linked to a GitHub repository.
// Auto-detects GitHub from entity links or forgeportal.dev/github-repo annotation.
registerPluginById('github-insights', registerGitHubInsights);

// Grafana plugin — embeds a Grafana dashboard iframe with time-range controls.
// No backend needed — purely client-side embedding.
// Annotate with: forgeportal.dev/grafana-dashboard-url
// Optional:      forgeportal.dev/grafana-variable-name
registerPluginById('grafana', registerGrafana);

// Example (uncomment when @myorg/forge-plugin-pagerduty is installed):
// import { registerPlugin as registerPagerDuty } from '@myorg/forge-plugin-pagerduty';
// registerPluginById('pagerduty', registerPagerDuty);

export { registerPluginById };
