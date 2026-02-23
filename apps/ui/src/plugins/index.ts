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

// ── Installed plugins ─────────────────────────────────────────────────────────
// (none installed in the base image — add imports here when plugins are added)

// Example (uncomment when @myorg/forge-plugin-pagerduty is installed):
// import { registerPlugin as registerPagerDuty } from '@myorg/forge-plugin-pagerduty';
// registerPluginById('pagerduty', registerPagerDuty);

export { registerPluginById };
