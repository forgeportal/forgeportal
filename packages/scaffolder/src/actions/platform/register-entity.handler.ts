import { z } from 'zod';
import type { Pool } from 'pg';
import type { ActionHandler, ActionContext, ActionResult } from '../../types.js';
import { ActionError } from '../../types.js';
import {
  EntityRepository,
  SourceRepository,
  ENTITY_KINDS,
  ENTITY_LIFECYCLES,
  RELATION_TYPES,
  enqueueScorecardEvalJobs,
} from '@forgeportal/catalog';

const registerEntityInputSchema = z.object({
  entity: z.object({
    kind: z.enum(ENTITY_KINDS),
    namespace: z.string().default('default'),
    name: z.string().min(1).max(255),
    ownerRef: z.string().optional(),
    lifecycle: z.enum(ENTITY_LIFECYCLES).optional(),
    tags: z.array(z.string()).default([]),
    links: z
      .array(z.object({ title: z.string(), url: z.string() }))
      .default([]),
    annotations: z.record(z.string()).default({}),
    scm: z.record(z.unknown()).default({}),
    spec: z.record(z.unknown()).default({}),
    relations: z
      .array(
        z.object({
          type: z.enum(RELATION_TYPES),
          target_entity_id: z.string().uuid(),
        }),
      )
      .default([]),
  }),
  source: z
    .object({
      provider: z.enum(['github', 'gitlab']),
      repoUrl: z.string().url(),
      path: z.string().default('/'),
    })
    .optional(),
});

export class RegisterEntityHandler implements ActionHandler {
  readonly actionId = 'catalog.registerEntity@v1';

  private readonly entityRepo: EntityRepository;
  private readonly sourceRepo: SourceRepository;

  constructor(private readonly pool: Pool) {
    this.entityRepo = new EntityRepository(pool);
    this.sourceRepo = new SourceRepository(pool);
  }

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const parsed = registerEntityInputSchema.safeParse(ctx.input);
    if (!parsed.success) {
      throw new ActionError('VALIDATION_ERROR', parsed.error.message);
    }
    const { entity, source } = parsed.data;

    await ctx.log('info', `Upserting entity ${entity.kind}/${entity.namespace}/${entity.name}`);

    const { entity: saved, created } = await this.entityRepo.upsert({
      kind: entity.kind,
      namespace: entity.namespace,
      name: entity.name,
      owner_ref: entity.ownerRef,
      lifecycle: entity.lifecycle,
      tags: entity.tags,
      links: entity.links,
      annotations: entity.annotations,
      scm: entity.scm,
      spec: entity.spec,
      relations: entity.relations,
    });

    if (source) {
      await this.sourceRepo.upsertSource({
        entity_id: saved.id,
        provider: source.provider,
        repo_url: source.repoUrl,
        path: source.path,
      });
      await ctx.log('info', `Source upserted: ${source.provider} ${source.repoUrl}`);
    }

    await ctx.log('info', `Entity ${created ? 'created' : 'updated'}: ${saved.id}`);

    // Auto-trigger scorecard evaluation so results appear immediately after
    // registration instead of waiting for the cron / manual trigger.
    try {
      const jobsEnqueued = await enqueueScorecardEvalJobs(
        this.pool,
        saved.id,
        entity.kind,
        true,
      );
      if (jobsEnqueued > 0) {
        await ctx.log('info', `Enqueued ${jobsEnqueued} scorecard-eval job(s) for ${saved.id}`);
      }
    } catch (err) {
      await ctx.log('warn', `Failed to enqueue scorecard-eval jobs: ${String(err)}`);
    }

    return {
      status: 'success',
      outputs: { entityId: saved.id },
      links: [{ title: 'Entity', url: `/catalog/${saved.id}` }],
      warnings: created ? [] : ['Entity already existed — updated in place'],
    };
  }
}
