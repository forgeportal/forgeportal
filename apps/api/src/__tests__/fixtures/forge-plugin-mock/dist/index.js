/**
 * Mock ForgePortal backend plugin — used in plugin-loader.test.ts
 * Registers one action provider (mock.echo@v1) and one backend route (/status).
 */

export function registerBackendPlugin(sdk) {
  sdk.registerActionProvider({
    id: 'mock.echo',
    version: 'v1',
    schema: {
      input: {
        type: 'object',
        properties: { message: { type: 'string' } },
        required: ['message'],
      },
      output: {
        type: 'object',
        properties: { echoed: { type: 'string' } },
      },
    },
    async handler(_ctx, input) {
      return {
        status: 'success',
        outputs: { echoed: input['message'] },
        links: [],
        warnings: [],
      };
    },
  });

  sdk.registerBackendRoute({
    path: '/status',
    async handler(fastify) {
      fastify.get('/status', async () => ({ status: 'ok', plugin: 'forge-plugin-mock' }));
    },
  });
}
