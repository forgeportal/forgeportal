import type { PluginNames, PluginType } from './names.js';

// ─── Shared templates ────────────────────────────────────────────────────────

export function genManifest(names: PluginNames, type: PluginType): string {
  const capabilities: Record<string, unknown> = {};
  if (type === 'ui' || type === 'fullstack') {
    capabilities['ui'] = { entityTabs: [`${names.pluginId}-tab`] };
  }
  if (type === 'backend' || type === 'fullstack') {
    capabilities['backend'] = {
      routes:          ['/status'],
      actionProviders: [`${names.pluginId}.myAction@v1`],
    };
  }

  return JSON.stringify(
    {
      name:    names.packageName,
      version: '1.0.0',
      forgeportal: {
        engineVersion: '^1.0.0',
        type,
        capabilities,
        config: {
          apiEndpoint: {
            type:        'string',
            description: `${names.title} API endpoint`,
            required:    false,
          },
        },
      },
    },
    null,
    2,
  );
}

export function genPackageJson(names: PluginNames, type: PluginType): string {
  const hasUi      = type === 'ui'      || type === 'fullstack';
  const hasBackend = type === 'backend' || type === 'fullstack';

  const peerDeps: Record<string, string> = {
    '@forgeportal/plugin-sdk': '^1.0.0',
  };
  const devDeps: Record<string, string> = {
    '@forgeportal/plugin-sdk': '^1.0.0',
    '@types/node':             '^22',
    typescript:                '^5',
  };

  if (hasUi) {
    peerDeps['react']       = '>=19';
    devDeps['@types/react'] = '^19';
    devDeps['react']        = '^19';
  }
  if (hasBackend) {
    devDeps['fastify']     = '^5';
    devDeps['@types/node'] = '^22';
  }

  const exports: Record<string, unknown> = {
    '.': { types: './dist/index.d.ts', import: './dist/index.js' },
  };
  if (type === 'fullstack') {
    exports['./ui']      = { types: './dist/ui/index.d.ts',      import: './dist/ui/index.js' };
    exports['./backend'] = { types: './dist/backend/index.d.ts', import: './dist/backend/index.js' };
  }

  return JSON.stringify(
    {
      name:        names.packageName,
      version:     '1.0.0',
      description: `ForgePortal ${type} plugin — ${names.title}`,
      type:        'module',
      main:        'dist/index.js',
      types:       'dist/index.d.ts',
      exports,
      scripts: {
        build: 'tsc',
        dev:   'tsc --watch',
        lint:  'eslint src/',
      },
      peerDependencies: peerDeps,
      devDependencies:  devDeps,
    },
    null,
    2,
  );
}

export function genTsConfig(type: PluginType): string {
  const hasUi = type === 'ui' || type === 'fullstack';

  const compilerOptions: Record<string, unknown> = {
    target:            'ES2022',
    module:            'NodeNext',
    moduleResolution:  'NodeNext',
    strict:            true,
    esModuleInterop:   true,
    skipLibCheck:      true,
    declaration:       true,
    declarationMap:    true,
    sourceMap:         true,
    outDir:            'dist',
    rootDir:           'src',
  };
  if (hasUi) {
    compilerOptions['jsx'] = 'react-jsx';
  }

  return JSON.stringify(
    {
      compilerOptions,
      include: ['src'],
      exclude: ['node_modules', 'dist'],
    },
    null,
    2,
  );
}

export function genReadme(names: PluginNames, type: PluginType): string {
  const uiSection = type === 'ui' || type === 'fullstack'
    ? `**UI** — add to \`apps/ui/src/plugins/index.ts\`:
\`\`\`typescript
import { registerPlugin } from '${names.packageName}${type === 'fullstack' ? '/ui' : ''}';
registerPluginById('${names.pluginId}', registerPlugin);
\`\`\``
    : '';

  const backendSection = type === 'backend' || type === 'fullstack'
    ? `**Backend** — add to \`forgeportal.yaml\`:
\`\`\`yaml
pluginPackages:
  packages:
    - "${names.packageName}"
\`\`\``
    : '';

  return `# ${names.packageName}

> ForgePortal ${type} plugin — ${names.title}

## Overview

This plugin was generated with [create-forge-plugin](https://github.com/your-org/forgeportal).

## Plugin Type

**${type}** — ${
    type === 'ui'       ? 'Provides UI components (entity tabs, cards, routes).' :
    type === 'backend'  ? 'Provides backend routes and action providers.' :
    'Provides both UI components and backend capabilities.'
  }

## Installation

In your ForgePortal monorepo:

\`\`\`bash
pnpm add ${names.packageName}
\`\`\`

Then register the plugin:

${uiSection}

${backendSection}

## Configuration

Add to \`forgeportal.yaml\`:

\`\`\`yaml
plugins:
  ${names.pluginId}:
    enabled: true
    config:
      apiEndpoint: "https://your-service.example.com"
\`\`\`

## Development

\`\`\`bash
pnpm install
pnpm build      # compile TypeScript
pnpm dev        # watch mode
\`\`\`

## License

MIT
`;
}

// ─── UI plugin templates ─────────────────────────────────────────────────────

export function genUiIndex(names: PluginNames): string {
  return `import type { ForgePluginSDK } from '@forgeportal/plugin-sdk';
import { ${names.pascalName}Tab } from './${names.pascalName}Tab.js';

/**
 * Register this plugin's UI capabilities with ForgePortal.
 * Called at UI startup by apps/ui/src/plugins/index.ts.
 *
 * To register: registerPluginById('${names.pluginId}', registerPlugin)
 */
export function registerPlugin(sdk: ForgePluginSDK): void {
  sdk.registerEntityTab({
    id:        '${names.pluginId}-tab',
    title:     '${names.title}',
    component: ${names.pascalName}Tab,
    appliesTo: { kinds: ['service'] }, // Adjust to your target entity kinds
  });
}
`;
}

export function genUiTab(names: PluginNames): string {
  return `import { useEntity, useConfig } from '@forgeportal/plugin-sdk/react';

/**
 * ${names.title} entity tab.
 * Rendered inside the entity detail page for entities of matching kinds.
 *
 * useEntity()        — access the current catalog entity
 * useConfig<T>(key) — access plugin config from forgeportal.yaml
 */
export function ${names.pascalName}Tab() {
  const { entity }     = useEntity();
  const apiEndpoint    = useConfig<string>('apiEndpoint');

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-3">${names.title}</h3>

      <div className="rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
        <p>Entity: <strong>{entity.name}</strong> ({entity.kind})</p>
        {apiEndpoint && (
          <p className="mt-1 text-xs text-gray-400">API: {apiEndpoint}</p>
        )}
      </div>

      {/* TODO: Implement your plugin UI here */}
      <p className="mt-4 text-sm text-gray-400 italic">
        This is a generated placeholder — implement ${names.title} content above.
      </p>
    </div>
  );
}
`;
}

// ─── Backend plugin templates ─────────────────────────────────────────────────

export function genBackendIndex(names: PluginNames): string {
  return `import type { ForgeBackendPluginSDK } from '@forgeportal/plugin-sdk';
import { ${names.camelName}Action } from './actions/${names.camelName}Action.js';

/**
 * Register this plugin's backend capabilities with ForgePortal.
 * Called at API server startup by apps/api/src/plugins/plugin-loader.ts.
 *
 * To register: add "${names.packageName}" to pluginPackages.packages in forgeportal.yaml
 */
export function registerBackendPlugin(sdk: ForgeBackendPluginSDK): void {
  // Register action providers (available in action runner and templates)
  sdk.registerActionProvider(${names.camelName}Action);

  // Register backend routes (mounted at /api/v1/plugins/${names.pluginId}/)
  sdk.registerBackendRoute({
    path: '/status',
    async handler(fastify) {
      fastify.get('/', async () => ({
        status: 'ok',
        plugin: '${names.pluginId}',
      }));

      // TODO: Add more routes here
      // Example: fastify.get('/data/:entityId', async (request) => { ... });
    },
  });
}
`;
}

export function genBackendAction(names: PluginNames): string {
  return `import type { ActionProvider } from '@forgeportal/plugin-sdk';

/**
 * ${names.title} action provider.
 * Registered as action ID: "${names.pluginId}.myAction@v1"
 *
 * Available in:
 *   - Action runner (POST /api/v1/actions/run)
 *   - Template steps (action: "${names.pluginId}.myAction@v1")
 */
export const ${names.camelName}Action: ActionProvider = {
  id:      '${names.pluginId}.myAction',
  version: 'v1',
  schema: {
    input: {
      type: 'object',
      properties: {
        message: {
          type:        'string',
          title:       'Message',
          description: 'The message to process',
        },
      },
      required: ['message'],
    },
    output: {
      type: 'object',
      properties: {
        result: { type: 'string', description: 'Action result' },
      },
    },
  },

  async handler(ctx, input) {
    ctx.logger.info('Running ${names.pluginId}.myAction', { input });
    await ctx.log('info', \`Processing: \${String(input['message'])}\`);

    // Available context:
    //   ctx.config.get<string>('apiEndpoint')  — plugin config
    //   ctx.scm.getFile(repoUrl, path)          — SCM file access (read-only)
    //   ctx.db.query(sql, params)               — DB read-only queries
    //   ctx.acquireRepoLock(repoUrl)            — prevent concurrent SCM writes

    // TODO: Implement your action logic here
    const result = \`Processed: \${String(input['message'])}\`;

    return {
      status:  'success',
      outputs: { result },
      links:   [],
    };
  },
};
`;
}

export function genBackendRoutes(names: PluginNames): string {
  return `import type { FastifyInstance } from 'fastify';

/**
 * Backend routes for the ${names.title} plugin.
 * Mounted at: /api/v1/plugins/${names.pluginId}/
 *
 * Import and use this in registerBackendPlugin:
 *   sdk.registerBackendRoute({ path: '/...', handler: registerRoutes });
 */
export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/plugins/${names.pluginId}/status
  fastify.get('/status', async () => ({
    status: 'ok',
    plugin: '${names.pluginId}',
  }));

  // TODO: Add your plugin routes here
  // All routes in this function are automatically scoped to /api/v1/plugins/${names.pluginId}/
  //
  // Example:
  // fastify.get('/data/:entityId', async (request) => {
  //   const { entityId } = request.params as { entityId: string };
  //   // fetch from your service ...
  //   return { entityId, data: [...] };
  // });
}
`;
}

// ─── Fullstack plugin templates ───────────────────────────────────────────────

export function genFullstackUiIndex(names: PluginNames): string {
  return `import type { ForgePluginSDK } from '@forgeportal/plugin-sdk';
import { ${names.pascalName}Card } from './${names.pascalName}Card.js';

export function registerPlugin(sdk: ForgePluginSDK): void {
  sdk.registerEntityCard({
    id:        '${names.pluginId}-card',
    title:     '${names.title}',
    component: ${names.pascalName}Card,
    appliesTo: { kinds: ['service'] },
  });
}
`;
}

export function genFullstackCard(names: PluginNames): string {
  return `import { useEntity, useApi } from '@forgeportal/plugin-sdk/react';

interface ${names.pascalName}Data {
  // TODO: Define the shape of data returned by your backend route
  message: string;
}

/**
 * ${names.title} entity card.
 * Fetches data from the backend route: GET /api/v1/plugins/${names.pluginId}/data/:entityId
 */
export function ${names.pascalName}Card() {
  const { entity } = useEntity();
  const { data, isPending, isError } = useApi<${names.pascalName}Data>(
    \`/api/v1/plugins/${names.pluginId}/data/\${entity.id}\`
  );

  if (isPending) {
    return (
      <div className="p-3 text-sm text-gray-400 animate-pulse">
        Loading ${names.title} data\u2026
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-3 text-sm text-red-500">
        Failed to load ${names.title} data.
      </div>
    );
  }

  return (
    <div className="p-3 text-sm text-gray-700">
      {/* TODO: Render your plugin data here */}
      <pre className="text-xs bg-gray-50 rounded p-2 overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
`;
}

export function genFullstackBackendIndex(names: PluginNames): string {
  return `import type { ForgeBackendPluginSDK } from '@forgeportal/plugin-sdk';

export function registerBackendPlugin(sdk: ForgeBackendPluginSDK): void {
  sdk.registerBackendRoute({
    path: '/',
    async handler(fastify) {
      // GET /api/v1/plugins/${names.pluginId}/data/:entityId
      fastify.get('/data/:entityId', async (request) => {
        const { entityId } = request.params as { entityId: string };

        // TODO: Fetch data from your external service
        return {
          entityId,
          message: 'Hello from ${names.title} plugin!',
        };
      });

      fastify.get('/status', async () => ({
        status: 'ok',
        plugin: '${names.pluginId}',
      }));
    },
  });
}
`;
}
