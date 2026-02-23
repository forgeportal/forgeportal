import { z } from 'zod';
import type { ActionHandler, ActionContext, ActionResult } from '../../types.js';
import { ActionError } from '../../types.js';
import type { SCMProviders } from '@forgeportal/scm';
import { mapScmError } from './scm-error-mapper.js';

const inputSchema = z.object({
  provider: z.enum(['github', 'gitlab']),
  owner: z.string().min(1),
  repo: z.string().min(1).max(100),
  visibility: z.enum(['private', 'internal', 'public']).default('private'),
  description: z.string().default(''),
  initWithReadme: z.boolean().default(false),
});

export class CreateRepoHandler implements ActionHandler {
  readonly actionId = 'scm.createRepo@v1';

  constructor(private readonly scmProviders: SCMProviders) {}

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const parsed = inputSchema.safeParse(ctx.input);
    if (!parsed.success) {
      throw new ActionError('VALIDATION_ERROR', parsed.error.message);
    }
    const { provider, owner, repo, visibility, description, initWithReadme } = parsed.data;

    const scm = this.scmProviders.get(provider);
    if (!scm) throw new ActionError('AUTH_ERROR', `SCM provider not configured: ${provider}`);

    await ctx.log('info', `Creating repo ${owner}/${repo} on ${provider}`);

    try {
      const existing = await scm.getRepo({ owner, repo });
      await ctx.log('info', `Repo ${owner}/${repo} already exists — returning existing`);
      return {
        status: 'success',
        outputs: { repoUrl: existing.url, defaultBranch: existing.defaultBranch },
        links: [{ title: 'Repository', url: existing.url }],
        warnings: ['Repository already existed — no changes made'],
      };
    } catch (err) {
      const e = err as { status?: number };
      if (e.status !== 404) {
        throw mapScmError(err, 'getRepo (idempotency check)');
      }
    }

    try {
      const created = await scm.createRepo({
        org: owner,
        name: repo,
        description: description ?? '',
        private: visibility !== 'public',
        autoInit: initWithReadme ?? false,
      });
      await ctx.log('info', `Repo created: ${created.url}`);
      return {
        status: 'success',
        outputs: { repoUrl: created.url, defaultBranch: created.defaultBranch },
        links: [{ title: 'Repository', url: created.url }],
        warnings: [],
      };
    } catch (err) {
      throw mapScmError(err, 'createRepo');
    }
  }
}
