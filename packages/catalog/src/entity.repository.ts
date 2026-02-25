import crypto from 'node:crypto';
import type { Pool } from 'pg';
import { ConflictError, NotFoundError } from '@forgeportal/core';
import type { EntityRow } from './entity.types.js';
import type { CreateEntityInput, ListEntitiesQuery, UpdateEntityInput } from './entity.schema.js';

const PG_UNIQUE_VIOLATION = '23505';

function mapRow(row: Record<string, unknown>): EntityRow {
  return {
    id: row['id'] as string,
    kind: row['kind'] as string,
    namespace: row['namespace'] as string,
    name: row['name'] as string,
    owner_ref: (row['owner_ref'] as string) ?? null,
    lifecycle: (row['lifecycle'] as string) ?? null,
    tags: (row['tags'] as string[]) ?? [],
    links: (row['links'] as { title: string; url: string }[]) ?? [],
    annotations: (row['annotations'] as Record<string, string>) ?? {},
    scm: (row['scm'] as Record<string, unknown>) ?? {},
    spec: (row['spec'] as Record<string, unknown>) ?? {},
    created_at: row['created_at'] as Date,
    updated_at: row['updated_at'] as Date,
  };
}

export class EntityRepository {
  constructor(private readonly pool: Pool) {}

  async upsert(data: CreateEntityInput): Promise<{ entity: EntityRow; created: boolean }> {
    const id = crypto.randomUUID();
    const result = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO entities
         (id, kind, namespace, name, owner_ref, lifecycle, tags, links, annotations, scm, spec)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (kind, namespace, name) DO UPDATE SET
         owner_ref   = EXCLUDED.owner_ref,
         lifecycle   = EXCLUDED.lifecycle,
         tags        = EXCLUDED.tags,
         links       = EXCLUDED.links,
         annotations = EXCLUDED.annotations,
         scm         = EXCLUDED.scm,
         spec        = EXCLUDED.spec,
         updated_at  = now()
       RETURNING *, (xmax = 0) AS inserted`,
      [
        id,
        data.kind,
        data.namespace ?? 'default',
        data.name,
        data.owner_ref ?? null,
        data.lifecycle ?? null,
        JSON.stringify(data.tags ?? []),
        JSON.stringify(data.links ?? []),
        JSON.stringify(data.annotations ?? {}),
        JSON.stringify(data.scm ?? {}),
        JSON.stringify(data.spec ?? {}),
      ],
    );
    const row = result.rows[0] as Record<string, unknown>;
    const created = row['inserted'] === true || row['inserted'] === 'true';
    return { entity: mapRow(row), created };
  }

  async create(data: CreateEntityInput): Promise<EntityRow> {
    const id = crypto.randomUUID();
    const row = {
      id,
      kind: data.kind,
      namespace: data.namespace ?? 'default',
      name: data.name,
      owner_ref: data.owner_ref ?? null,
      lifecycle: data.lifecycle ?? null,
      tags: JSON.stringify(data.tags ?? []),
      links: JSON.stringify(data.links ?? []),
      annotations: JSON.stringify(data.annotations ?? {}),
      scm: JSON.stringify(data.scm ?? {}),
      spec: JSON.stringify(data.spec ?? {}),
    };

    try {
      const result = await this.pool.query(
        `INSERT INTO entities (id, kind, namespace, name, owner_ref, lifecycle, tags, links, annotations, scm, spec)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          row.id,
          row.kind,
          row.namespace,
          row.name,
          row.owner_ref,
          row.lifecycle,
          row.tags,
          row.links,
          row.annotations,
          row.scm,
          row.spec,
        ],
      );
      return mapRow(result.rows[0] as Record<string, unknown>);
    } catch (err: unknown) {
      const pgErr = err as { code?: string };
      if (pgErr.code === PG_UNIQUE_VIOLATION) {
        throw new ConflictError(
          `Entity already exists: ${row.kind}/${row.namespace}/${row.name}`,
        );
      }
      throw err;
    }
  }

  async findById(id: string): Promise<EntityRow | null> {
    const result = await this.pool.query(
      `SELECT * FROM entities WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async findByRef(
    kind: string,
    namespace: string,
    name: string,
  ): Promise<EntityRow | null> {
    const result = await this.pool.query(
      `SELECT * FROM entities WHERE kind = $1 AND namespace = $2 AND name = $3`,
      [kind, namespace, name],
    );
    if (result.rows.length === 0) return null;
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async list(filters: ListEntitiesQuery): Promise<{
    data: EntityRow[];
    total: number;
  }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (filters.kind) {
      conditions.push(`kind = $${paramIdx++}`);
      params.push(filters.kind);
    }
    if (filters.owner) {
      conditions.push(`owner_ref = $${paramIdx++}`);
      params.push(filters.owner);
    }
    if (filters.tag) {
      conditions.push(`tags @> $${paramIdx++}::jsonb`);
      params.push(JSON.stringify([filters.tag]));
    }
    if (filters.lifecycle) {
      conditions.push(`lifecycle = $${paramIdx++}`);
      params.push(filters.lifecycle);
    }

    let orderBy = 'updated_at DESC';
    let selectExtra = '';

    if (filters.q && filters.q.trim()) {
      conditions.push(
        `search_tsv @@ plainto_tsquery('english', $${paramIdx})`,
      );
      selectExtra = `, ts_rank(search_tsv, plainto_tsquery('english', $${paramIdx})) AS rank`;
      params.push(filters.q.trim());
      paramIdx++;
      orderBy = 'rank DESC, name ASC';
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(filters.offset);
    params.push(filters.limit);

    const sql = `SELECT *${selectExtra}, COUNT(*) OVER() AS total
      FROM entities ${where}
      ORDER BY ${orderBy}
      OFFSET $${paramIdx++} LIMIT $${paramIdx}`;

    const result = await this.pool.query(sql, params);
    const total =
      result.rows.length > 0
        ? Number((result.rows[0] as Record<string, unknown>)['total'])
        : 0;
    const data = result.rows.map((r) => {
      const row = { ...r } as Record<string, unknown>;
      delete row['rank'];
      delete row['total'];
      return mapRow(row);
    });
    return { data, total };
  }

  async update(id: string, data: UpdateEntityInput): Promise<EntityRow> {
    const updates: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    const fields: (keyof UpdateEntityInput)[] = [
      'owner_ref',
      'lifecycle',
      'tags',
      'links',
      'annotations',
      'scm',
      'spec',
    ];
    for (const key of fields) {
      const v = data[key];
      if (v === undefined) continue;
      if (key === 'tags' || key === 'links' || key === 'annotations' || key === 'scm' || key === 'spec') {
        updates.push(`${key} = $${paramIdx++}::jsonb`);
        params.push(JSON.stringify(v));
      } else {
        updates.push(`${key} = $${paramIdx++}`);
        params.push(v);
      }
    }

    if (updates.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new NotFoundError('Entity not found');
      return existing;
    }

    updates.push(`updated_at = now()`);
    params.push(id);

    const result = await this.pool.query(
      `UPDATE entities SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      params,
    );
    if (result.rows.length === 0) {
      throw new NotFoundError('Entity not found');
    }
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM entities WHERE id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
