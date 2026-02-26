import type { ActionProvider } from '@forgeportal/plugin-sdk';
import type { ArgocdConfig } from './types.js';
import { ArgocdApiClient } from './api-client.js';

/**
 * argocd.syncApp@v1
 *
 * Triggers a manual sync of an ArgoCD application.
 * Usable in templates and scorecard fix actions.
 *
 * Input:
 *   - appName: string (required) — ArgoCD application name
 */
export function createSyncAppAction(config: ArgocdConfig): ActionProvider {
  return {
    id:      'argocd.syncApp',
    version: 'v1',
    schema: {
      input: {
        type:       'object',
        required:   ['appName'],
        properties: {
          appName: {
            type:        'string',
            title:       'Application Name',
            description: 'Name of the ArgoCD application to sync.',
          },
        },
      },
      output: {
        type: 'object',
        properties: {
          syncTriggeredAt: { type: 'string', description: 'ISO timestamp when sync was triggered.' },
        },
      },
    },

    async handler(ctx, input) {
      const appName = input['appName'] as string;
      ctx.logger.info(`Triggering ArgoCD sync for application "${appName}"`);

      const client = new ArgocdApiClient(config);
      await client.syncApp(appName);

      const syncTriggeredAt = new Date().toISOString();
      ctx.logger.info(`Sync triggered for "${appName}" at ${syncTriggeredAt}`);

      return {
        status:  'success',
        outputs: { syncTriggeredAt },
        links: [
          { title: `Open ${appName} in ArgoCD`, url: `${config.url}/applications/${appName}` },
        ],
      };
    },
  };
}

/**
 * argocd.rollbackApp@v1
 *
 * Rolls back an ArgoCD application to a specific history entry.
 *
 * Input:
 *   - appName:   string (required)
 *   - historyId: number (required) — history entry ID from the app history
 */
export function createRollbackAppAction(config: ArgocdConfig): ActionProvider {
  return {
    id:      'argocd.rollbackApp',
    version: 'v1',
    schema: {
      input: {
        type:       'object',
        required:   ['appName', 'historyId'],
        properties: {
          appName: {
            type:        'string',
            title:       'Application Name',
            description: 'Name of the ArgoCD application to roll back.',
          },
          historyId: {
            type:        'number',
            title:       'History ID',
            description: 'History entry ID to roll back to (from the sync history list).',
          },
        },
      },
      output: {
        type: 'object',
        properties: {
          rolledBackAt: { type: 'string', description: 'ISO timestamp of the rollback trigger.' },
        },
      },
    },

    async handler(ctx, input) {
      const appName   = input['appName'] as string;
      const historyId = input['historyId'] as number;

      ctx.logger.info(`Rolling back ArgoCD application "${appName}" to history entry ${historyId}`);

      const client = new ArgocdApiClient(config);
      await client.rollbackApp(appName, historyId);

      const rolledBackAt = new Date().toISOString();
      ctx.logger.info(`Rollback triggered for "${appName}" at ${rolledBackAt}`);

      return {
        status:  'success',
        outputs: { rolledBackAt },
        links: [
          { title: `Open ${appName} in ArgoCD`, url: `${config.url}/applications/${appName}` },
        ],
      };
    },
  };
}
