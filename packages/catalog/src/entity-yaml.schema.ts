import { z } from 'zod';
import { ENTITY_KINDS, ENTITY_LIFECYCLES } from './entity.types.js';

export const entityYamlSchema = z.object({
  apiVersion: z.literal('forgeportal/v1'),
  kind: z.enum(ENTITY_KINDS),
  metadata: z.object({
    name: z.string().min(1).max(255),
    namespace: z.string().default('default'),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    links: z
      .array(
        z.object({
          title: z.string(),
          url: z.string().url(),
        }),
      )
      .default([]),
    annotations: z.record(z.string()).optional().default({}),
  }),
  spec: z
    .object({
      owner: z.string().optional(),
      lifecycle: z.enum(ENTITY_LIFECYCLES).optional(),
      dependsOn: z.array(z.string()).default([]),
      providesApi: z.array(z.string()).default([]),
      consumesApi: z.array(z.string()).default([]),
    })
    .passthrough()
    .default({}),
});

export type EntityYaml = z.infer<typeof entityYamlSchema>;
