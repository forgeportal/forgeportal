import { z } from 'zod';
import type { ActionHandler, ActionContext, ActionResult } from '../../types.js';
import { ActionError } from '../../types.js';
import type { SCMProviders } from '@forgeportal/scm';
import { mapScmError, buildRepoUrl } from './scm-error-mapper.js';

const inputSchema = z.object({
  provider: z.enum(['github', 'gitlab']),
  owner: z.string().min(1),
  repo: z.string().min(1),
  defaultBranch: z.string().default('main'),
  path: z.string().min(1),
  contentBase64: z.string().min(1),
  message: z.string().min(1),
  branch: z.string().optional(),
  expectedSha: z.string().optional(),
});

export class CreateOrUpdateFileHandler implements ActionHandler {
  readonly actionId = 'scm.createOrUpdateFile@v1';

  constructor(private readonly scmProviders: SCMProviders) {}

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const parsed = inputSchema.safeParse(ctx.input);
    if (!parsed.success) {
      throw new ActionError('VALIDATION_ERROR', parsed.error.message);
    }
    const { provider, owner, repo, defaultBranch, path, contentBase64, message, branch, expectedSha } =
      parsed.data;

    const scm = this.scmProviders.get(provider);
    if (!scm) throw new ActionError('AUTH_ERROR', `SCM provider not configured: ${provider}`);

    const targetBranch = branch ?? defaultBranch;
    const ref = { owner, repo };
    const repoUrl = buildRepoUrl(provider, owner, repo);
    const rawContent = Buffer.from(contentBase64, 'base64').toString('utf-8');

    await ctx.acquireRepoLock(repoUrl);
    await ctx.log('info', `Writing file ${path} on branch ${targetBranch}`);

    const existing = await scm.getFile(ref, path, targetBranch);

    if (existing) {
      if (existing.content === rawContent) {
        await ctx.log('debug', `File ${path} unchanged — skipping`);
        return {
          status: 'success',
          outputs: { commitSha: existing.sha, fileUrl: '' },
          links: [],
          warnings: ['File unchanged — no write performed'],
        };
      }
      if (expectedSha && expectedSha !== existing.sha) {
        throw new ActionError(
          'CONFLICT',
          `expectedSha ${expectedSha} does not match current sha ${existing.sha} for ${path}`,
        );
      }
    }

    try {
      const result = await scm.createOrUpdateFile(
        ref,
        path,
        rawContent,
        message,
        targetBranch,
        existing?.sha,
      );
      await ctx.log('info', `File written: ${path} (commit ${result.sha.slice(0, 7)})`);
      return {
        status: 'success',
        outputs: { commitSha: result.sha, fileUrl: result.url },
        links: result.url ? [{ title: 'Commit', url: result.url }] : [],
        warnings: [],
      };
    } catch (err) {
      const e = err as { status?: number };
      if (e.status === 409) {
        throw new ActionError('CONFLICT', `Concurrent write conflict on ${path}: ${String(err)}`);
      }
      throw mapScmError(err, 'createOrUpdateFile');
    }
  }
}
