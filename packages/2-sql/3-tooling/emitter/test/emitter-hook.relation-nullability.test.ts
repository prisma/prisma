import type { ContractModelBase, ContractRelation } from '@internal/contract/types';
import { crossRef } from '@internal/contract/types';
import { keepInternalSpecifiers } from '@internal/framework-components/emission';
import { describe, expect, it } from 'vitest';
import { sqlEmission } from '../src/index';
import { createEmitterTestContract as createContract } from './create-emitter-test-contract';

const int = (nullable: boolean) => ({ nativeType: 'int4', codecId: 'pg/int4@1', nullable });

const toUser = (localField: string): ContractRelation => ({
  to: crossRef('User', '__unbound__'),
  cardinality: 'N:1',
  on: { localFields: [localField], targetFields: ['id'] },
});

const post: ContractModelBase = {
  fields: {
    id: { nullable: false, type: { kind: 'scalar', codecId: 'pg/int4@1' } },
    authorId: { nullable: false, type: { kind: 'scalar', codecId: 'pg/int4@1' } },
    editorId: { nullable: true, type: { kind: 'scalar', codecId: 'pg/int4@1' } },
    reviewerId: { nullable: false, type: { kind: 'scalar', codecId: 'pg/int4@1' } },
  },
  relations: {},
  storage: {
    namespaceId: '__unbound__',
    table: 'post',
    fields: {
      id: { column: 'id' },
      authorId: { column: 'author_id' },
      editorId: { column: 'editor_id' },
      reviewerId: { column: 'reviewer_id' },
    },
  },
};

const foreignKey = (column: string) => ({
  source: { namespaceId: '__unbound__', tableName: 'post', columns: [column] },
  target: { namespaceId: '__unbound__', tableName: 'user', columns: ['id'] },
});

const contract = createContract({
  models: { Post: post },
  storage: {
    tables: {
      user: {
        columns: { id: int(false) },
        primaryKey: { columns: ['id'] },
        uniques: [],
        indexes: [],
        foreignKeys: [],
      },
      post: {
        columns: {
          id: int(false),
          author_id: int(false),
          editor_id: int(true),
          reviewer_id: int(false),
        },
        primaryKey: { columns: ['id'] },
        uniques: [],
        indexes: [],
        foreignKeys: [foreignKey('author_id'), foreignKey('editor_id')],
      },
    },
  },
});

function nullable(relation: ContractRelation): boolean {
  return sqlEmission.isToOneRelationNullable(post, relation, contract);
}

describe('sqlEmission.isToOneRelationNullable', () => {
  it('is non-nullable when the table owns a foreign key over a required column', () => {
    expect(nullable(toUser('authorId'))).toBe(false);
  });

  it('is nullable when the foreign key column is nullable', () => {
    expect(nullable(toUser('editorId'))).toBe(true);
  });

  it('is nullable when the table has no foreign key for the local columns', () => {
    expect(nullable(toUser('reviewerId'))).toBe(true);
  });

  it('is nullable when a foreign-key column is absent from the table columns, as the ORM type is', () => {
    const withoutAuthorColumn = createContract({
      models: { Post: post },
      storage: {
        tables: {
          user: {
            columns: { id: int(false) },
            primaryKey: { columns: ['id'] },
            uniques: [],
            indexes: [],
            foreignKeys: [],
          },
          post: {
            columns: { id: int(false) },
            primaryKey: { columns: ['id'] },
            uniques: [],
            indexes: [],
            foreignKeys: [foreignKey('author_id')],
          },
        },
      },
    });
    expect(sqlEmission.isToOneRelationNullable(post, toUser('authorId'), withoutAuthorColumn)).toBe(
      true,
    );
  });

  it('is nullable when the storage plane is missing', () => {
    expect(
      sqlEmission.isToOneRelationNullable(post, toUser('authorId'), {
        ...contract,
        storage: undefined as unknown as typeof contract.storage,
      }),
    ).toBe(true);
  });
});

describe('sqlEmission.getFamilyImports', () => {
  it('imports RelationKeys from the family types entrypoint', () => {
    expect(sqlEmission.getFamilyImports(keepInternalSpecifiers).join('\n')).toContain(
      'RelationKeys,',
    );
  });
});
