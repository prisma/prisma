import { temporalCodecPreset } from '@internal/framework-components/authoring';
import { describe, expect, it } from 'vitest';
import { modelsOf, postgresScalarTypeDescriptors, temporalCodecPresetMirrors } from './fixtures';
import { sqlStorageFromSuccessfulSqlInterpretation } from './interpret-sql-contract-storage';
import {
  builtinControlMutationDefaults,
  interpretPostgresSchema,
} from './interpreter-defaults-support';
import { unboundTables } from './unbound-tables';

describe('generated values with a database default or on an optional field', () => {
  const contributions = {
    field: {
      temporal: {
        timestamptz: temporalCodecPresetMirrors.pgTimestamptz,
        timestampString: temporalCodecPresetMirrors.pgTimestampString,
        dateString: temporalCodecPreset({ codecId: 'pg/date-string@1' }, 'dateTextNow'),
      },
    },
  } as const;

  it('keeps the preset generators, the database default and the nullability', () => {
    const result = interpretPostgresSchema(
      `model Post {
  id        Int @id
  updatedAt temporal.timestampString(3, onCreate: now, onUpdate: now) @default(now())
  touchedAt temporal.timestamptz(onUpdate: now) @default(now())
  token     String? @default(uuid())
  editedAt  temporal.timestampString(3, onCreate: now, onUpdate: now)?
  day       temporal.dateString(onCreate: now, onUpdate: now)?
}`,
      {
        scalarColumnDescriptors: postgresScalarTypeDescriptors,
        controlMutationDefaults: builtinControlMutationDefaults,
        authoringContributions: contributions,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const nowDefault = { kind: 'function', expression: 'now()' };
    expect(unboundTables(sqlStorageFromSuccessfulSqlInterpretation(result.value))['Post']).toEqual({
      columns: {
        id: { many: false, dataType: 'pg/int4', codecId: 'pg/int4@1', nullable: false },
        updatedAt: {
          many: false,
          dataType: 'pg/timestamp',
          codecId: 'pg/timestamp-string@1',
          nullable: false,
          typeParams: { precision: 3 },
          default: nowDefault,
        },
        touchedAt: {
          many: false,
          dataType: 'pg/timestamptz',
          codecId: 'pg/timestamptz-temporal@1',
          nullable: false,
          default: nowDefault,
        },
        token: { many: false, dataType: 'pg/text', codecId: 'pg/text@1', nullable: true },
        editedAt: {
          many: false,
          dataType: 'pg/timestamp',
          codecId: 'pg/timestamp-string@1',
          nullable: true,
          typeParams: { precision: 3 },
        },
        day: { many: false, dataType: 'pg/date', codecId: 'pg/date-string@1', nullable: true },
      },
      primaryKey: { columns: ['id'] },
      uniques: [],
      indexes: [],
      foreignKeys: [],
    });
    const scalar = (codecId: string, nullable: boolean, typeParams?: { precision: number }) => ({
      many: false,
      nullable,
      type: { kind: 'scalar', codecId, ...(typeParams ? { typeParams } : {}) },
    });
    const fieldNames = ['id', 'updatedAt', 'touchedAt', 'token', 'editedAt', 'day'];
    expect(JSON.parse(JSON.stringify(modelsOf(result.value)['Post']))).toEqual({
      fields: {
        id: scalar('pg/int4@1', false),
        updatedAt: scalar('pg/timestamp-string@1', false, { precision: 3 }),
        touchedAt: scalar('pg/timestamptz-temporal@1', false),
        token: scalar('pg/text@1', true),
        editedAt: scalar('pg/timestamp-string@1', true, { precision: 3 }),
        day: scalar('pg/date-string@1', true),
      },
      relations: {},
      storage: {
        namespaceId: 'public',
        table: 'Post',
        fields: Object.fromEntries(fieldNames.map((name) => [name, { column: name }])),
      },
    });

    const ref = (field: string) => ({ namespace: 'public', entry: 'Post', field });
    const timestampTextNow = { kind: 'generator', id: 'timestampTextNow' };
    expect(result.value.execution?.mutations.defaults).toEqual([
      {
        ref: ref('day'),
        onCreate: { kind: 'generator', id: 'dateTextNow' },
        onUpdate: { kind: 'generator', id: 'dateTextNow' },
      },
      { ref: ref('editedAt'), onCreate: timestampTextNow, onUpdate: timestampTextNow },
      { ref: ref('token'), onCreate: { kind: 'generator', id: 'uuidv4' } },
      { ref: ref('touchedAt'), onUpdate: { kind: 'generator', id: 'timestampNow' } },
      { ref: ref('updatedAt'), onCreate: timestampTextNow, onUpdate: timestampTextNow },
    ]);
  });
});
