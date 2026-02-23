import crypto from 'node:crypto';
import type { Pool } from 'pg';
import type { EntityRelationRow, EntityRow } from './entity.types.js';
import type { RelationType } from './entity.types.js';

const RELATION_TYPES_LIST = [
  'dependsOn',
  'ownedBy',
  'partOf',
  'providesApi',
  'consumesApi',
] as const;

function mapRelationRow(row: Record<string, unknown>): EntityRelationRow {
  return {
    id: row['id'] as string,
    from_entity_id: row['from_entity_id'] as string,
    type: row['type'] as string,
    to_entity_id: row['to_entity_id'] as string,
    created_at: row['created_at'] as Date,
  };
}

export class RelationRepository {
  constructor(private readonly pool: Pool) {}

  async setRelations(
    entityId: string,
    relations: { type: RelationType; target_entity_id: string }[],
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM entity_relations WHERE from_entity_id = $1`,
        [entityId],
      );
      if (relations.length > 0) {
        for (const rel of relations) {
          if (!RELATION_TYPES_LIST.includes(rel.type)) continue;
          const id = crypto.randomUUID();
          await client.query(
            `INSERT INTO entity_relations (id, from_entity_id, type, to_entity_id)
             VALUES ($1, $2, $3, $4)`,
            [id, entityId, rel.type, rel.target_entity_id],
          );
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  async getRelationsForEntity(
    entityId: string,
  ): Promise<(EntityRelationRow & { direction: 'from' | 'to' })[]> {
    const result = await this.pool.query(
      `SELECT * FROM entity_relations
       WHERE from_entity_id = $1 OR to_entity_id = $1`,
      [entityId],
    );
    return result.rows.map((r) => {
      const row = mapRelationRow(r as Record<string, unknown>);
      const direction =
        row.from_entity_id === entityId ? ('from' as const) : ('to' as const);
      return { ...row, direction };
    });
  }

  async getRelatedEntities(
    entityId: string,
  ): Promise<{ relation: EntityRelationRow; entity: EntityRow }[]> {
    const relations = await this.getRelationsForEntity(entityId);
    const out: { relation: EntityRelationRow; entity: EntityRow }[] = [];
    for (const rel of relations) {
      const otherId =
        rel.direction === 'from' ? rel.to_entity_id : rel.from_entity_id;
      const entityResult = await this.pool.query(
        `SELECT * FROM entities WHERE id = $1`,
        [otherId],
      );
      if (entityResult.rows.length === 0) continue;
      const entityRow = entityResult.rows[0] as Record<string, unknown>;
      out.push({
        relation: {
          id: rel.id,
          from_entity_id: rel.from_entity_id,
          type: rel.type,
          to_entity_id: rel.to_entity_id,
          created_at: rel.created_at,
        },
        entity: {
          id: entityRow['id'] as string,
          kind: entityRow['kind'] as string,
          namespace: entityRow['namespace'] as string,
          name: entityRow['name'] as string,
          owner_ref: (entityRow['owner_ref'] as string) ?? null,
          lifecycle: (entityRow['lifecycle'] as string) ?? null,
          tags: (entityRow['tags'] as string[]) ?? [],
          links: (entityRow['links'] as { title: string; url: string }[]) ?? [],
          scm: (entityRow['scm'] as Record<string, unknown>) ?? {},
          spec: (entityRow['spec'] as Record<string, unknown>) ?? {},
          created_at: entityRow['created_at'] as Date,
          updated_at: entityRow['updated_at'] as Date,
        },
      });
    }
    return out;
  }
}
