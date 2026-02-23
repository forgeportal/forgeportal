import { z } from 'zod';
import type { ActionHandler, ActionContext, ActionResult } from '../../types.js';
import { ActionError } from '../../types.js';
import type { SCMProviders } from '@forgeportal/scm';
import { mapScmError } from './scm-error-mapper.js';

const inputSchema = z.object({
  provider: z.enum(['github', 'gitlab']),
  owner: z.string().min(1),
  repo: z.string().min(1),
  callbackUrl: z.string().url(),
  events: z.array(z.string()).default(['push']),
});

export class EnsureWebhookHandler implements ActionHandler {
  readonly actionId = 'scm.ensureWebhook@v1';

  constructor(private readonly scmProviders: SCMProviders) {}

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const parsed = inputSchema.safeParse(ctx.input);
    if (!parsed.success) {
      throw new ActionError('VALIDATION_ERROR', parsed.error.message);
    }
    const { provider, owner, repo, callbackUrl, events } = parsed.data;

    const scm = this.scmProviders.get(provider);
    if (!scm) throw new ActionError('AUTH_ERROR', `SCM provider not configured: ${provider}`);

    const ref = { owner, repo };
    const warnings: string[] = [];

    if (callbackUrl.startsWith('http://')) {
      warnings.push('callbackUrl uses HTTP — HTTPS is strongly recommended for webhooks');
    }

    await ctx.log('info', `Ensuring webhook ${callbackUrl} on ${owner}/${repo}`);

    try {
      const result = await scm.ensureWebhook(ref, callbackUrl, events);
      await ctx.log('info', `Webhook ensured: id=${String(result.id)}`);
      return {
        status: 'success',
        outputs: { webhookId: String(result.id), webhookUrl: callbackUrl },
        links: [],
        warnings,
      };
    } catch (err) {
      throw mapScmError(err, 'ensureWebhook');
    }
  }
}
