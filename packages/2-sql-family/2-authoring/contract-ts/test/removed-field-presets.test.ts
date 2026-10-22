import type { FamilyPackRef, TargetPackRef } from '@internal/framework-components/components';
import { describe, expect, it } from 'vitest';
import { testTypeLookups } from '../../../1-core/contract/test/test-type-lookups';
import { createComposedAuthoringHelpers } from '../src/composed-authoring-helpers';
import { field } from '../src/contract-dsl';
import { refusingRemovedFieldPresets } from '../src/removed-field-presets';
import { columnDescriptor } from './helpers/column-descriptor';

const GUIDE = 'The upgrade guide "Field presets are removed" lists every rewrite.';

const typeConstructor = (codecId: string) =>
  ({ kind: 'typeConstructor', output: { codecId } }) as const;

const postgresLike = {
  String: typeConstructor('pg/text@1'),
  Jsonb: typeConstructor('pg/jsonb@1'),
  Uuid: typeConstructor('pg/uuid@1'),
  Time: typeConstructor('pg/time-temporal@1'),
  DateTime: typeConstructor('pg/timestamptz-temporal@1'),
  sql: { Char: typeConstructor('sql/char@1') },
  temporal: {
    UpdatedAt: {
      kind: 'typeAlias',
      output: { type: { codecId: 'pg/timestamptz-temporal@1' } },
    },
  },
} as const;

const sqliteLike = {
  String: typeConstructor('sqlite/text@1'),
  Json: typeConstructor('sqlite/json@1'),
  DateTime: typeConstructor('sqlite/datetime@1'),
  sql: { Char: typeConstructor('sql/char@1') },
} as const;

function readPath(root: object, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => Reflect.get(Object(value), key), root);
}

function refusalOf(helpers: object, path: string) {
  try {
    readPath(helpers, path);
  } catch (error) {
    return error;
  }
  throw new Error(`reading field.${path} did not throw`);
}

const removed = (path: string, rewrite: string) => ({
  code: 'CONTRACT.FIELD_HELPER_UNKNOWN',
  message: `field.${path} was a field preset, and Prisma 8 removed field presets. Write ${rewrite}. ${GUIDE}`,
  meta: { helper: `field.${path}` },
});

const unknown = (path: string) => ({
  code: 'CONTRACT.FIELD_HELPER_UNKNOWN',
  message: `field.${path} does not exist. Prisma 8 removed field presets: declare a column as field.column(type.X(...)), add .id(), .onCreate(gen.fn()) and .onUpdate(gen.fn()) for what a preset set, or use a type alias such as field.column(type.temporal.CreatedAt()). ${GUIDE}`,
  meta: { helper: `field.${path}` },
});

describe('a read of a removed field preset from the SQL field helpers', () => {
  const postgresField = refusingRemovedFieldPresets(field, postgresLike);
  const sqliteField = refusingRemovedFieldPresets(field, sqliteLike);

  it.each([
    ['text', 'field.column(type.String())'],
    ['json', 'field.column(type.Jsonb())'],
    ['uuidString', 'field.column(type.sql.Char(36))'],
    [
      'nanoid',
      'field.column(type.sql.Char(21)), or field.column(type.sql.Char(n)) for nanoid({ size: n })',
    ],
    ['id.uuidv4String', 'field.column(type.sql.Char(36)).id().onCreate(gen.uuid())'],
    ['id.uuidv7Native', 'field.column(type.Uuid()).id().onCreate(gen.uuid(7))'],
    ['temporal.updatedAt', 'field.column(type.temporal.UpdatedAt())'],
    [
      'temporal.time',
      'field.column(type.Time(p)), with .onCreate(gen.now()) and .onUpdate(gen.now()) for the phases the preset set, and without p when it set no precision',
    ],
    [
      'generated',
      'field.column(type.sql.Char(n)).onCreate(gen.fn()), such as field.column(type.sql.Char(36)).onCreate(gen.uuid()) for field.generated(uuidv4())',
    ],
  ])('names the rewrite of field.%s where the stack has its type', (path, rewrite) => {
    expect(refusalOf(postgresField, path)).toMatchObject(removed(path, rewrite));
  });

  it.each([
    ['json', 'the stack has no Jsonb'],
    ['text', 'String stores another codec'],
    ['temporal.updatedAt', 'the stack has no temporal.UpdatedAt'],
  ])('names the forms that replace presets for field.%s where %s', (path) => {
    expect(refusalOf(sqliteField, path)).toMatchObject(unknown(path));
  });

  it('names the rewrite of a preset whose type the stack has with its codec', () => {
    expect(refusalOf(sqliteField, 'temporal.datetime')).toMatchObject(
      removed(
        'temporal.datetime',
        'field.column(type.DateTime()), with .onCreate(gen.now()) and .onUpdate(gen.now()) for the phases the preset set',
      ),
    );
  });

  it('reads every name that was never a preset as on the helpers', () => {
    expect(
      ['length', 'name', 'default', 'uuidv4String', 'colum', 'id.uuidv7', 'temporal.now'].map(
        (path) => readPath(postgresField, path),
      ),
    ).toEqual([undefined, undefined, undefined, undefined, undefined, undefined, undefined]);
  });

  it('refuses the read on the field a defineContract callback receives', () => {
    const helpers = createComposedAuthoringHelpers({
      ...testTypeLookups,
      family: {
        kind: 'family',
        id: 'sql',
        familyId: 'sql',
        version: '0.0.1',
        authoring: { type: postgresLike },
      } satisfies FamilyPackRef<'sql'>,
      target: {
        kind: 'target',
        id: 'postgres',
        familyId: 'sql',
        targetId: 'postgres',
        version: '0.0.1',
        defaultNamespaceId: 'public',
      } satisfies TargetPackRef<'sql', 'postgres'>,
    });
    expect(refusalOf(helpers.field, 'id.uuidv4String')).toMatchObject(
      removed('id.uuidv4String', 'field.column(type.sql.Char(36)).id().onCreate(gen.uuid())'),
    );
  });

  it('keeps every helper the builder has', () => {
    expect([
      postgresField.column(columnDescriptor('pg/text@1')).build().descriptor,
      Object.keys(postgresField),
    ]).toEqual([{ codecId: 'pg/text@1' }, ['column', 'namedType']]);
  });
});
