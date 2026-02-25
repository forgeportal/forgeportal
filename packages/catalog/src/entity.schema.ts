import { z } from 'zod';
import { scmOwnerRepoSchema } from '@forgeportal/core';
import {
  ENTITY_KINDS,
  ENTITY_LIFECYCLES,
  RELATION_TYPES,
} from './entity.types.js';

const linkSchema = z.object({
  title: z.string(),
  url: z.string().url(),
});

const relationInputSchema = z.object({
  type: z.enum(RELATION_TYPES),
  target_entity_id: z.string().uuid(),
});

export const createEntitySchema = z.object({
  kind: z.enum(ENTITY_KINDS),
  namespace: z.string().default('default'),
  name: z.string().min(1).max(255),
  owner_ref: z.string().optional(),
  lifecycle: z.enum(ENTITY_LIFECYCLES).optional(),
  tags: z.array(z.string()).default([]),
  links: z.array(linkSchema).default([]),
  annotations: z.record(z.string()).default({}),
  scm: z
    .object({
      owner: scmOwnerRepoSchema.optional(),
      repo: scmOwnerRepoSchema.optional(),
    })
    .passthrough()
    .default({}),
  spec: z.record(z.unknown()).default({}),
  relations: z.array(relationInputSchema).default([]),
});

export const updateEntitySchema = createEntitySchema
  .partial()
  .omit({ kind: true, namespace: true, name: true });

export const listEntitiesQuerySchema = z.object({
  kind: z.string().optional(),
  owner: scmOwnerRepoSchema.optional(),
  tag: z.string().optional(),
  lifecycle: z.string().optional(),
  q: z.string().optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateEntityInput = z.infer<typeof createEntitySchema>;
export type UpdateEntityInput = z.infer<typeof updateEntitySchema>;
export type ListEntitiesQuery = z.infer<typeof listEntitiesQuerySchema>;
