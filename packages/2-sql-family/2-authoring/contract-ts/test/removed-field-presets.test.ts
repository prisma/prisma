import type { FamilyPackRef, TargetPackRef } from '@internal/framework-components/components';
import { describe, expect, it } from 'vitest';
import { testTypeLookups } from '../../../1-core/contract/test/test-type-lookups';
import { createComposedAuthoringHelpers } from '../src/composed-authoring-helpers';
import { field } from '../src/contract-dsl';
import { columnDescriptor } from './helpers/column-descriptor';

const GUIDE = 'The upgrade guide "Field presets are removed" lists every rewrite.';

function readPath(root: object, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => Reflect.get(Object(value), key), root);
}

function refusalOf(path: string) {
  try {
    readPath(field, path);
  } catch (error) {
    return error;
  }
  throw new Error(`reading field.${path} did not throw`);
}

describe('a read of a field helper the SQL builder does not have', () => {
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
  ])('refuses the removed preset field.%s with its rewrite', (path, rewrite) => {
    expect(refusalOf(path)).toMatchObject({
      code: 'CONTRACT.FIELD_HELPER_UNKNOWN',
      message: `field.${path} was a field preset, and Prisma 8 removed field presets. Write ${rewrite}. ${GUIDE}`,
      meta: { helper: `field.${path}` },
    });
  });

  it.each(['uuidv4String', 'id.uuidv7', 'temporal.now'])(
    'refuses field.%s, which never existed, naming the forms that replace presets',
    (path) => {
      expect(refusalOf(path)).toMatchObject({
        code: 'CONTRACT.FIELD_HELPER_UNKNOWN',
        message: `field.${path} does not exist. Prisma 8 removed field presets: declare a column as field.column(type.X(...)), add .id(), .onCreate(gen.fn()) and .onUpdate(gen.fn()) for what a preset set, or use a type alias such as field.column(type.temporal.CreatedAt()). ${GUIDE}`,
      });
    },
  );

  it('refuses the read on the field a defineContract callback receives', () => {
    const helpers = createComposedAuthoringHelpers({
      ...testTypeLookups,
      family: {
        kind: 'family',
        id: 'sql',
        familyId: 'sql',
        version: '0.0.1',
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
    expect(() => readPath(helpers.field, 'id.uuidv4String')).toThrow(
      expect.objectContaining({ code: 'CONTRACT.FIELD_HELPER_UNKNOWN' }),
    );
  });

  it('keeps every helper the builder has', () => {
    expect(field.column(columnDescriptor('pg/text@1')).build()).toMatchObject({
      descriptor: { codecId: 'pg/text@1' },
    });
    expect(Object.keys(field)).toEqual(['column', 'namedType']);
  });
});
