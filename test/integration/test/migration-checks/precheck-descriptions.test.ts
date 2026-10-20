/**
 * When a check before an operation fails, a runner explains it from the check's description (`readCheckDescription` in the framework-components source, imported by path as it is not part of any package's public surface): an object that should be absent is already in the database, or one that should be present is not. This test builds the prechecks of every operation each target's factories make and pins what each description reads as, so rewording a check in a target fails here instead of quietly changing or losing the explanation.
 */
import type { ExecuteRequestLowerer } from '@internal/family-sql/control-adapter';
import { DdlColumn } from '@internal/sql-relational-core/ast';
import { col, fn, lit } from '@internal/sql-relational-core/contract-free';
import { parseNaming } from '@internal/sql-schema-ir/naming';
import {
  collMod,
  createCollection,
  createIndex,
  dropCollection,
  dropIndex,
  renameCollection,
  renameField,
  setValidation,
  unsetField,
} from '@internal/target-mongo/migration';
import { postgresDataTypes } from '@internal/target-postgres/data-types';
import * as pg from '@internal/target-postgres/op-factory-call';
import { PostgresRlsPolicy } from '@internal/target-postgres/types';
import * as sqlite from '@internal/target-sqlite/op-factory-call';
import { describe, expect, it } from 'vitest';
import { readCheckDescription } from '../../../../packages/1-framework/1-core/framework-components/src/control/runner-failure-why';

type Reading = 'absent' | 'present' | 'neither';

interface Built {
  readonly precheck: readonly { readonly description: string }[];
}

const lowerer: ExecuteRequestLowerer = {
  lower: () => ({ sql: '', params: [] }),
  lowerToExecuteRequest: async () => ({ sql: '', params: [] }),
  renderColumnDefault: async () => "DEFAULT 'x'",
};

async function firstOp(
  call:
    | { toOp(lowerer: ExecuteRequestLowerer): Promise<Built> | Built }
    | { toOps(lowerer: ExecuteRequestLowerer): readonly Promise<Built>[] },
): Promise<Built> {
  if ('toOps' in call) {
    const [first] = await Promise.all(call.toOps(lowerer));
    if (first === undefined) throw new Error('the call makes no operations');
    return first;
  }
  return call.toOp(lowerer);
}

const policy = new PostgresRlsPolicy({
  naming: parseNaming('item_read', undefined),
  tableName: 'item',
  namespaceId: 'public',
  operation: 'select',
  roles: [],
  using: 'true',
  withCheck: undefined,
  permissive: true,
});

const cases: ReadonlyArray<readonly [string, () => Promise<Built> | Built, readonly Reading[]]> = [
  [
    'postgres createTable',
    () => firstOp(new pg.CreateTableCall('public', 'item', [col('id', 'int4')])),
    ['absent'],
  ],
  ['postgres dropTable', () => firstOp(new pg.DropTableCall('public', 'item')), ['present']],
  [
    'postgres renameTable',
    () => firstOp(new pg.RenameTableCall('public', 'item', 'thing', [])),
    ['present', 'absent'],
  ],
  [
    'postgres addColumn',
    () => firstOp(new pg.AddColumnCall('public', 'item', col('x', 'int4'), postgresDataTypes)),
    ['absent'],
  ],
  [
    'postgres renameColumn',
    () => firstOp(new pg.RenameColumnCall('public', 'item', 'x', 'y', [])),
    ['present', 'absent'],
  ],
  ['postgres dropColumn', () => firstOp(new pg.DropColumnCall('public', 'item', 'x')), ['present']],
  [
    'postgres alterColumnType',
    () =>
      firstOp(
        new pg.AlterColumnTypeCall({
          schemaName: 'public',
          tableName: 'item',
          columnName: 'x',
          type: 'int8',
          dataTypes: postgresDataTypes,
          ownsAutoincrementSequence: true,
        }),
      ),
    ['present', 'neither'],
  ],
  [
    'postgres setNotNull',
    () => firstOp(new pg.SetNotNullCall('public', 'item', 'x')),
    ['present', 'neither'],
  ],
  [
    'postgres dropNotNull',
    () => firstOp(new pg.DropNotNullCall('public', 'item', 'x')),
    ['present'],
  ],
  [
    'postgres setDefault',
    () =>
      firstOp(
        new pg.SetDefaultCall(
          'public',
          'item',
          col('x', 'text', { default: lit('a') }),
          'additive',
        ),
      ),
    ['present'],
  ],
  [
    'postgres setDefault(autoincrement())',
    () =>
      firstOp(
        new pg.SetDefaultCall(
          'public',
          'item',
          col('x', 'int4', { default: fn('autoincrement()') }),
          'additive',
        ),
      ),
    ['present', 'neither'],
  ],
  [
    'postgres dropDefault',
    () => firstOp(new pg.DropDefaultCall('public', 'item', 'x')),
    ['present'],
  ],
  [
    'postgres addRequiredColumnToEmptyTable',
    () =>
      firstOp(
        new pg.AddRequiredColumnToEmptyTableCall('public', 'item', 'x', 'int4', postgresDataTypes),
      ),
    ['absent', 'neither'],
  ],
  [
    'postgres addColumnWithTemporaryDefault',
    () =>
      firstOp(
        new pg.AddColumnWithTemporaryDefaultCall(
          'public',
          'item',
          'x',
          'int4',
          '0',
          postgresDataTypes,
        ),
      ),
    ['absent'],
  ],
  [
    'postgres addPrimaryKey',
    () => firstOp(new pg.AddPrimaryKeyCall('public', 'item', 'item_pkey', ['id'])),
    ['absent'],
  ],
  [
    'postgres addUnique',
    () => firstOp(new pg.AddUniqueCall('public', 'item', 'item_key', ['x'])),
    ['absent'],
  ],
  [
    'postgres addForeignKey',
    () =>
      firstOp(
        new pg.AddForeignKeyCall('public', 'item', {
          name: 'item_fk',
          columns: ['x'],
          references: { schema: 'public', table: 'other', columns: ['id'] },
        }),
      ),
    ['absent'],
  ],
  [
    'postgres addCheckConstraint',
    () => firstOp(new pg.AddCheckConstraintCall('public', 'item', 'item_check', 'x > 0')),
    ['absent'],
  ],
  [
    'postgres renameConstraint',
    () => firstOp(new pg.RenameConstraintCall('public', 'item', 'unique', 'a', 'b')),
    ['present', 'absent'],
  ],
  [
    'postgres dropConstraint',
    () => firstOp(new pg.DropConstraintCall('public', 'item', 'item_key')),
    ['present'],
  ],
  [
    'postgres dropCheckConstraint',
    () => firstOp(new pg.DropCheckConstraintCall('public', 'item', 'item_check')),
    ['present'],
  ],
  [
    'postgres createIndex',
    () => firstOp(new pg.CreateIndexCall('public', 'item', 'item_idx', { columns: ['x'] })),
    ['absent'],
  ],
  [
    'postgres renameIndex',
    () => firstOp(new pg.RenameIndexCall('public', 'item', 'a', 'b')),
    ['present', 'absent'],
  ],
  [
    'postgres dropIndex',
    () => firstOp(new pg.DropIndexCall('public', 'item', 'item_idx')),
    ['present'],
  ],
  [
    'postgres createNativeEnumType',
    () => firstOp(new pg.CreateNativeEnumTypeCall('public', 'Mood', ['a'])),
    [],
  ],
  [
    'postgres dropNativeEnumType',
    () => firstOp(new pg.DropNativeEnumTypeCall('public', 'Mood')),
    [],
  ],
  [
    'postgres addNativeEnumValue',
    () => firstOp(new pg.AddNativeEnumValueCall('public', 'Mood', 'b')),
    ['present', 'absent'],
  ],
  ['postgres createSchema', () => firstOp(new pg.CreateSchemaCall('app')), []],
  ['postgres createExtension', () => new pg.CreateExtensionCall('citext').toOp(), []],
  [
    'postgres createRlsPolicy',
    () => firstOp(new pg.CreatePostgresRlsPolicyCall('public', 'item', policy)),
    ['absent'],
  ],
  [
    'postgres renameRlsPolicy',
    () => firstOp(new pg.RenamePostgresRlsPolicyCall('public', 'item', 'a', 'b')),
    ['present', 'absent'],
  ],
  [
    'postgres dropRlsPolicy',
    () => firstOp(new pg.DropPostgresRlsPolicyCall('public', 'item', 'a')),
    ['present'],
  ],
  [
    'postgres enableRowLevelSecurity',
    () => firstOp(new pg.EnableRowLevelSecurityCall('public', 'item')),
    ['neither'],
  ],
  [
    'postgres disableRowLevelSecurity',
    () => firstOp(new pg.DisableRowLevelSecurityCall('public', 'item')),
    ['neither'],
  ],
  [
    'sqlite createTable',
    () =>
      firstOp(new sqlite.CreateTableCall('item', [new DdlColumn({ name: 'id', type: 'INTEGER' })])),
    ['absent'],
  ],
  ['sqlite dropTable', () => firstOp(new sqlite.DropTableCall('item')), ['present']],
  [
    'sqlite renameTable',
    () => firstOp(new sqlite.RenameTableCall('item', 'thing', [])),
    ['present', 'neither'],
  ],
  [
    'sqlite renameColumn',
    () => firstOp(new sqlite.RenameColumnCall('item', 'x', 'y', [])),
    ['present', 'absent'],
  ],
  [
    'sqlite addColumn',
    () => firstOp(new sqlite.AddColumnCall('item', { name: 'x', typeSql: 'TEXT', nullable: true })),
    ['absent'],
  ],
  ['sqlite dropColumn', () => firstOp(new sqlite.DropColumnCall('item', 'x')), ['present']],
  [
    'sqlite createIndex',
    () => firstOp(new sqlite.CreateIndexCall('item', 'item_idx', ['x'])),
    ['absent'],
  ],
  ['sqlite dropIndex', () => firstOp(new sqlite.DropIndexCall('item', 'item_idx')), ['present']],
  ['mongo createIndex', () => createIndex('users', [{ field: 'email', direction: 1 }]), ['absent']],
  ['mongo dropIndex', () => dropIndex('users', [{ field: 'email', direction: 1 }]), ['present']],
  ['mongo createCollection', () => createCollection('users'), ['absent']],
  ['mongo dropCollection', () => dropCollection('users'), []],
  ['mongo renameCollection', () => renameCollection('users', 'people'), ['present', 'absent']],
  ['mongo setValidation', () => setValidation('users', { bsonType: 'object' }), ['present']],
  [
    'mongo collMod',
    () => collMod('users', { validator: { $jsonSchema: { bsonType: 'object' } } }),
    ['present'],
  ],
  ['mongo renameField', () => renameField('users', 'name', 'fullName'), ['neither']],
  ['mongo unsetField', () => unsetField('users', 'legacy'), ['neither']],
];

function readingOf(description: string): Reading {
  return readCheckDescription(description)?.expects ?? 'neither';
}

describe('what each precheck description reads as', () => {
  it.each(cases)('%s', async (_name, build, expected) => {
    const op = await build();
    const descriptions = op.precheck.map((step) => step.description);

    expect(descriptions.map((description) => [description, readingOf(description)])).toEqual(
      descriptions.map((description, index) => [description, expected[index]]),
    );
  });

  it('names, for an absent or present reading, only names the description mentions', async () => {
    for (const [, build] of cases) {
      for (const { description } of (await build()).precheck) {
        const names = readCheckDescription(description)?.object.match(/"[^"]*"/g) ?? [];
        for (const name of names) expect(description).toContain(name);
      }
    }
  });
});
