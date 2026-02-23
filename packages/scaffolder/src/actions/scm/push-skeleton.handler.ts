import { z } from 'zod';
import type { ActionHandler, ActionContext, ActionResult } from '../../types.js';
import { ActionError } from '../../types.js';
import type { SCMProvider, SCMProviders } from '@forgeportal/scm';
import { mapScmError, buildRepoUrl } from './scm-error-mapper.js';

const fileSchema = z.object({
  path: z.string().min(1),
  contentBase64: z.string().min(1),
});

const inputSchema = z.object({
  provider: z.enum(['github', 'gitlab']),
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().default('main'),
  message: z.string().default('chore: scaffold files'),
  files: z.array(fileSchema).min(1, 'files must be a non-empty array'),
});

export class PushSkeletonHandler implements ActionHandler {
  readonly actionId = 'scm.pushSkeleton@v1';

  constructor(private readonly scmProviders: SCMProviders) {}

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const parsed = inputSchema.safeParse(ctx.input);
    if (!parsed.success) {
      throw new ActionError('VALIDATION_ERROR', parsed.error.message);
    }
    const { provider, owner, repo, branch, message, files } = parsed.data;

    const scm = this.scmProviders.get(provider);
    if (!scm) throw new ActionError('AUTH_ERROR', `SCM provider not configured: ${provider}`);

    const ref = { owner, repo };
    const repoUrl = buildRepoUrl(provider, owner, repo);

    await ctx.acquireRepoLock(repoUrl);
    await ctx.log('info', `Advisory lock acquired for ${repoUrl}`);

    const commitShas: string[] = [];
    const changedFiles: string[] = [];
    const skippedFiles: string[] = [];

    for (const file of files) {
      const rawContent = Buffer.from(file.contentBase64, 'base64').toString('utf-8');

      let existing: Awaited<ReturnType<SCMProvider['getFile']>>;
      try {
        existing = await scm.getFile(ref, file.path, branch);
      } catch (err) {
        throw mapScmError(err, `getFile(${file.path})`);
      }

      if (existing && existing.content === rawContent) {
        skippedFiles.push(file.path);
        await ctx.log('debug', `Skipping unchanged file: ${file.path}`);
        continue;
      }

      try {
        const result = await scm.createOrUpdateFile(
          ref,
          file.path,
          rawContent,
          message,
          branch,
          existing?.sha,
        );
        commitShas.push(result.sha);
        changedFiles.push(file.path);
        await ctx.log('info', `Written: ${file.path} (${result.sha.slice(0, 7)})`);
      } catch (err) {
        throw mapScmError(err, `createOrUpdateFile(${file.path})`);
      }
    }

    const warnings: string[] = [];
    if (skippedFiles.length > 0) {
      warnings.push(`${skippedFiles.length} file(s) unchanged and skipped`);
    }

    return {
      status: 'success',
      outputs: { commitShas, changedFiles },
      links: [],
      warnings,
    };
  }
}
