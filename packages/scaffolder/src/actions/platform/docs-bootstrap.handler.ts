import { z } from 'zod';
import type { Pool } from 'pg';
import type { ActionHandler, ActionContext, ActionResult } from '../../types.js';
import { ActionError } from '../../types.js';
import type { SCMProviders } from '@forgeportal/scm';
import { DocsRepository } from '@forgeportal/docs';
import { enqueueJob } from '@forgeportal/db';
import { buildRepoUrl, mapScmError } from '../scm/scm-error-mapper.js';

const docsBootstrapInputSchema = z.object({
  provider: z.enum(['github', 'gitlab']),
  owner: z.string().min(1),
  repo: z.string().min(1),
  branch: z.string().default('main'),
  docsPath: z.string().default('docs'),
  entityId: z.string().uuid().optional(),
});

function buildDocsIndexContent(repo: string): string {
  return `# ${repo} Documentation

Welcome to the documentation for **${repo}**.

## Overview

Add your service overview here.

## Getting Started

Describe how to get started with this service.
`;
}

export class DocsBootstrapHandler implements ActionHandler {
  readonly actionId = 'docs.bootstrap@v1';

  private readonly docsRepo: DocsRepository;

  constructor(
    private readonly pool: Pool,
    private readonly scmProviders: SCMProviders,
  ) {
    this.docsRepo = new DocsRepository(pool);
  }

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const parsed = docsBootstrapInputSchema.safeParse(ctx.input);
    if (!parsed.success) {
      throw new ActionError('VALIDATION_ERROR', parsed.error.message);
    }
    const { provider, owner, repo, branch, docsPath, entityId } = parsed.data;

    const scm = this.scmProviders.get(provider);
    if (!scm) throw new ActionError('AUTH_ERROR', `SCM provider not configured: ${provider}`);

    const ref = { owner, repo };
    const repoUrl = buildRepoUrl(provider, owner, repo);
    const filePath = `${docsPath}/index.md`;
    const content = buildDocsIndexContent(repo);

    await ctx.acquireRepoLock(repoUrl);
    await ctx.log('info', `Bootstrapping docs at ${filePath} in ${repoUrl}`);

    // Idempotency: skip if file already exists with same content
    try {
      const existing = await scm.getFile(ref, filePath, branch);
      if (existing && existing.content === content) {
        await ctx.log('debug', `${filePath} already exists with same content — skipping write`);
      } else {
        await scm.createOrUpdateFile(
          ref,
          filePath,
          content,
          'docs: bootstrap docs index',
          branch,
          existing?.sha,
        );
        await ctx.log('info', `Written: ${filePath}`);
      }
    } catch (err) {
      throw mapScmError(err, 'createOrUpdateFile (docs/index.md)');
    }

    const warnings: string[] = [];

    if (entityId) {
      await this.docsRepo.upsertBinding({
        entityId,
        repoUrl,
        docsPath,
      });
      await ctx.log('info', `docs_bindings upserted for entity ${entityId}`);

      // Fire-and-forget: enqueue docs-index job for immediate FTS indexing
      enqueueJob(this.pool, 'docs-index', {
        entityId,
        repoUrl,
        changedPaths: [filePath],
      }).then(() => {
        void ctx.log('info', 'Enqueued docs-index job for immediate indexing');
      }).catch(() => {
        // Non-critical — the next webhook will trigger re-indexing
      });
    } else {
      warnings.push(
        'No entityId — docs_bindings not created. Provide entityId to enable FTS indexing.',
      );
    }

    return {
      status: 'success',
      outputs: { docsHome: filePath },
      links: [],
      warnings,
    };
  }
}
