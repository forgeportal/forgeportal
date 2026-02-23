import { z } from 'zod';
import type { ActionHandler, ActionContext, ActionResult } from '../../types.js';
import { ActionError } from '../../types.js';
import type { SCMProviders } from '@forgeportal/scm';
import { mapScmError } from './scm-error-mapper.js';

const inputSchema = z.object({
  provider: z.enum(['github', 'gitlab']),
  owner: z.string().min(1),
  repo: z.string().min(1),
  headBranch: z.string().min(1),
  baseBranch: z.string().min(1),
  title: z.string().min(1),
  body: z.string().default(''),
});

export class OpenPrOrMrHandler implements ActionHandler {
  readonly actionId = 'scm.openPrOrMr@v1';

  constructor(private readonly scmProviders: SCMProviders) {}

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const parsed = inputSchema.safeParse(ctx.input);
    if (!parsed.success) {
      throw new ActionError('VALIDATION_ERROR', parsed.error.message);
    }
    const { provider, owner, repo, headBranch, baseBranch, title, body } = parsed.data;

    const scm = this.scmProviders.get(provider);
    if (!scm) throw new ActionError('AUTH_ERROR', `SCM provider not configured: ${provider}`);

    const ref = { owner, repo };

    await ctx.log('info', `Opening PR/MR ${headBranch} → ${baseBranch} on ${owner}/${repo}`);

    try {
      const existing = await scm.listPullRequests(ref, headBranch, baseBranch);
      if (existing.length > 0) {
        const pr = existing[0];
        await ctx.log('info', `PR/MR already exists: #${pr.number}`);
        return {
          status: 'success',
          outputs: { url: pr.url, number: pr.number },
          links: [{ title: 'Pull Request', url: pr.url }],
          warnings: ['PR/MR already existed for this head→base — returning existing'],
        };
      }
    } catch (err) {
      throw mapScmError(err, 'listPullRequests');
    }

    try {
      const pr = await scm.createPullRequest(ref, {
        title,
        body,
        head: headBranch,
        base: baseBranch,
      });
      await ctx.log('info', `PR/MR created: #${pr.number} ${pr.url}`);
      return {
        status: 'success',
        outputs: { url: pr.url, number: pr.number },
        links: [{ title: 'Pull Request', url: pr.url }],
        warnings: [],
      };
    } catch (err) {
      const e = err as { status?: number; message?: string };
      // GitHub 422 "A pull request already exists" race condition — re-fetch
      if (e.status === 422 && e.message?.toLowerCase().includes('pull request already exists')) {
        try {
          const existing = await scm.listPullRequests(ref, headBranch, baseBranch);
          if (existing.length > 0) {
            const pr = existing[0];
            await ctx.log('info', `Race condition resolved: PR #${pr.number} already exists`);
            return {
              status: 'success',
              outputs: { url: pr.url, number: pr.number },
              links: [{ title: 'Pull Request', url: pr.url }],
              warnings: ['PR/MR created concurrently — returning existing'],
            };
          }
        } catch {
          // fall through to original error
        }
      }
      throw mapScmError(err, 'createPullRequest');
    }
  }
}
