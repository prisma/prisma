import type { FamilyPackRef, TargetPackRef } from '@prisma-next/framework-components/components';
import { describe, expect, it } from 'vitest';
import { createTestSqlNamespace } from '../../../1-core/contract/test/test-support';
import { type ContractInput, defineContract, field, model, rel } from '../src/contract-builder';
import { columnDescriptor } from './helpers/column-descriptor';
import { testIndexPack } from './helpers/test-index-pack';
import { unboundTables } from './unbound-tables';

const int4Column = columnDescriptor('pg/int4@1');
const textColumn = columnDescriptor('pg/text@1');

const bareFamilyPack: FamilyPackRef<'sql'> = {
  kind: 'family',
  id: 'sql',
  familyId: 'sql',
  version: '0.0.1',
};

const postgresTargetPack: TargetPackRef<'sql', 'postgres'> = {
  kind: 'target',
  id: 'postgres',
  familyId: 'sql',
  targetId: 'postgres',
  version: '0.0.1',
  defaultNamespaceId: 'public',
};

function defineTestContract<
  const Types extends NonNullable<ContractInput['types']> = Record<never, never>,
  const Models extends NonNullable<ContractInput['models']> = Record<never, never>,
  const Extensions extends NonNullable<ContractInput['extensions']> | undefined = undefined,
>(
  definition: Omit<
    ContractInput<typeof bareFamilyPack, typeof postgresTargetPack, Types, Models, Extensions>,
    'family' | 'target' | 'createNamespace'
  >,
) {
  return defineContract({
    family: bareFamilyPack,
    target: postgresTargetPack,
    createNamespace: createTestSqlNamespace,
    ...definition,
  });
}

describe('index naming at TS lowering', () => {
  it('unnamed index lowers managed with the default prefix and a content-hash wire name', () => {
    const contract = defineTestContract({
      models: {
        User: model('User', {
          fields: {
            id: field.column(int4Column).id(),
            email: field.column(textColumn),
          },
        }).sql(({ cols, constraints }) => ({
          table: 'user',
          indexes: [constraints.index([cols.email])],
        })),
      },
    });

    expect(unboundTables(contract.storage)['user']!.indexes).toEqual([
      {
        name: 'user_email_idx_46df9cad',
        prefix: 'user_email_idx',
        columns: ['email'],
        unique: false,
      },
    ]);
  });

  it('named index lowers managed with the authored name as prefix', () => {
    const contract = defineTestContract({
      models: {
        User: model('User', {
          fields: {
            id: field.column(int4Column).id(),
            email: field.column(textColumn),
          },
        }).sql(({ cols, constraints }) => ({
          table: 'user',
          indexes: [constraints.index([cols.email], { name: 'user_email_lookup' })],
        })),
      },
    });

    expect(unboundTables(contract.storage)['user']!.indexes).toEqual([
      {
        name: 'user_email_lookup_46df9cad',
        prefix: 'user_email_lookup',
        columns: ['email'],
        unique: false,
      },
    ]);
  });

  it('type and options participate in the wire hash', () => {
    const contract = defineContract(
      {
        family: bareFamilyPack,
        target: postgresTargetPack,
        extensions: { testIndexes: testIndexPack },
        createNamespace: createTestSqlNamespace,
      },
      ({ model: helperModel, field: helperField }) => ({
        models: {
          Doc: helperModel('Doc', {
            fields: {
              id: helperField.column(int4Column).id(),
              body: helperField.column(textColumn),
            },
          }).sql(({ cols, constraints }) => ({
            table: 'doc',
            indexes: [
              constraints.index([cols.body], { type: 'bm25', options: { key_field: 'id' } }),
            ],
          })),
        },
      }),
    );

    expect(unboundTables(contract.storage)['doc']!.indexes).toEqual([
      {
        name: 'doc_body_idx_a755c485',
        prefix: 'doc_body_idx',
        columns: ['body'],
        unique: false,
        type: 'bm25',
        options: { key_field: 'id' },
      },
    ]);
  });

  it('FK-backing index materializes managed with the default FK-index name as prefix', () => {
    const User = model('User', {
      fields: {
        id: field.column(int4Column).id(),
      },
    }).sql({ table: 'user' });

    const Post = model('Post', {
      fields: {
        id: field.column(int4Column).id(),
        userId: field.column(int4Column),
      },
      relations: {
        user: rel.belongsTo(User, { from: 'userId', to: 'id' }).sql({ fk: { index: true } }),
      },
    }).sql({ table: 'post' });

    const contract = defineTestContract({ models: { User, Post } });

    expect(unboundTables(contract.storage)['post']!.indexes).toEqual([
      {
        name: 'post_userId_idx_a489d58a',
        prefix: 'post_userId_idx',
        columns: ['userId'],
        unique: false,
      },
    ]);
  });

  it('rejects an authored index name over the 54-character prefix cap', () => {
    const longName = 'a'.repeat(55);
    expect(() =>
      defineTestContract({
        models: {
          User: model('User', {
            fields: {
              id: field.column(int4Column).id(),
              email: field.column(textColumn),
            },
          }).sql(({ cols, constraints }) => ({
            table: 'user',
            indexes: [constraints.index([cols.email], { name: longName })],
          })),
        },
      }),
    ).toThrow(new RegExp(`"${longName}" exceeds the 54-character maximum`));
  });
});
