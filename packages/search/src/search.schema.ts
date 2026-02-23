import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().min(1, 'Query must not be empty').max(200),
  scope: z.enum(['all', 'entities', 'docs']).default('all'),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
