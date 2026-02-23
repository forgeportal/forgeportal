import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  mainSidebar: [
    {
      type:  'doc',
      id:    'intro',
      label: '⚡ Welcome to ForgePortal',
    },

    // ── Getting Started ───────────────────────────────────────────────────────
    {
      type:      'category',
      label:     '🚀 Getting Started',
      collapsed: false,
      items: [
        'getting-started/overview',
        'getting-started/quick-start-docker',
        'getting-started/local-dev-setup',
        'getting-started/first-entity',
      ],
    },

    // ── Core Concepts ─────────────────────────────────────────────────────────
    {
      type:  'category',
      label: '🧠 Core Concepts',
      items: [
        'concepts/architecture',
        'concepts/entity-model',
        'concepts/catalog',
        'concepts/templates-and-actions',
        'concepts/scorecards',
        'concepts/plugin-system',
      ],
    },

    // ── User Guide ────────────────────────────────────────────────────────────
    {
      type:  'category',
      label: '👤 User Guide',
      items: [
        'user-guide/catalog-browsing',
        'user-guide/running-templates',
        'user-guide/monitoring-actions',
        'user-guide/scorecards-and-fixes',
        'user-guide/role-guide',
      ],
    },

    // ── Plugin Development ────────────────────────────────────────────────────
    {
      type:  'category',
      label: '🔌 Plugin Development',
      items: [
        'plugin-development/overview',
        'plugin-development/create-ui-plugin',
        'plugin-development/create-backend-plugin',
        'plugin-development/create-fullstack-plugin',
        'plugin-development/sdk-reference',
        'plugin-development/plugin-manifest',
      ],
    },

    // ── Configuration ─────────────────────────────────────────────────────────
    {
      type:  'category',
      label: '⚙️ Configuration',
      items: [
        'configuration/forgeportal-yaml',
        'configuration/oidc-setup',
        'configuration/scm-providers',
        'configuration/env-vars',
      ],
    },

    // ── API Reference ─────────────────────────────────────────────────────────
    {
      type:  'category',
      label: '📡 API Reference',
      items: [
        'api/overview',
        'api/catalog-api',
        'api/templates-api',
        'api/scorecards-api',
        'api/search-api',
        'api/webhooks',
        'api/plugins-api',
      ],
    },

    // ── Deployment ────────────────────────────────────────────────────────────
    {
      type:  'category',
      label: '🚢 Deployment',
      items: [
        'deployment/docker-compose',
        'deployment/kubernetes-helm',
        'deployment/production-checklist',
        'deployment/troubleshooting',
      ],
    },

    // ── Contributing ──────────────────────────────────────────────────────────
    {
      type:  'category',
      label: '🤝 Contributing',
      items: [
        'contributing/how-to-contribute',
        'contributing/architectural-decisions',
      ],
    },
  ],
};

export default sidebars;
