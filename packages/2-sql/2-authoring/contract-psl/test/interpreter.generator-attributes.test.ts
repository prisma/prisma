import type { AuthoringContributions } from '@internal/framework-components/authoring';
import { describe, expect, it } from 'vitest';
import { fixtureGeneratorFunctions } from './fixture-generator-functions';
import { postgresNativeScalarTypeDescriptors, postgresScalarAuthoringTypes } from './fixtures';
import { sqlStorageFromSuccessfulSqlInterpretation } from './interpret-sql-contract-storage';
import {
  builtinControlMutationDefaults,
  interpretPostgresSchema,
} from './interpreter-defaults-support';
import { unboundTables } from './unbound-tables';

const authoringContributions = {
  entityTypes: {},
  field: {},
  pslBlockDescriptors: {},
  modelAttributes: {},
  type: postgresScalarAuthoringTypes,
} satisfies AuthoringContributions;

function interpret(schema: string) {
  return interpretPostgresSchema(schema, {
    scalarColumnDescriptors: postgresNativeScalarTypeDescriptors,
    controlMutationDefaults: builtinControlMutationDefaults,
    generatorFunctions: fixtureGeneratorFunctions,
    authoringContributions,
  });
}

function executionDefaults(schema: string) {
  const result = interpret(schema);
  if (!result.ok) throw new Error(JSON.stringify(result.failure.diagnostics, null, 2));
  return result.value.execution?.mutations.defaults ?? [];
}

function diagnostics(schema: string) {
  const result = interpret(schema);
  if (result.ok) throw new Error('expected the schema to be refused');
  return result.failure.diagnostics.map(({ code, message }) => ({ code, message }));
}

function ref(field: string, entry = 'Event') {
  return { namespace: 'public', entry, field };
}

describe('@onCreate and @onUpdate', () => {
  it('lower each field to the generator its codec binds', () => {
    expect(
      executionDefaults(`model Event {
  id        String      @id @onCreate(uuid(7))
  code      VarChar(32) @onCreate(nanoid())
  seenAt    Time(3)     @onUpdate(now())
  createdAt DateTime    @default(now()) @onCreate(now())
}`),
    ).toEqual([
      { ref: ref('code'), onCreate: { kind: 'generator', id: 'nanoid' } },
      { ref: ref('createdAt'), onCreate: { kind: 'generator', id: 'instantNow' } },
      { ref: ref('id'), onCreate: { kind: 'generator', id: 'uuidv7' } },
      {
        ref: ref('seenAt'),
        onUpdate: { kind: 'generator', id: 'plainTimeNow', params: { precision: 3 } },
      },
    ]);
  });

  it('keep a database default beside a generator on create', () => {
    const result = interpret(`model Event {
  id        Int      @id
  createdAt DateTime @default(now()) @onCreate(now())
}`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect({
      column: unboundTables(sqlStorageFromSuccessfulSqlInterpretation(result.value))['Event']
        ?.columns['createdAt'],
      defaults: result.value.execution?.mutations.defaults,
    }).toEqual({
      column: {
        many: false,
        codecId: 'pg/timestamptz-temporal@1',
        dataType: 'pg/timestamptz',
        nullable: false,
        default: { kind: 'function', expression: 'now()' },
      },
      defaults: [{ ref: ref('createdAt'), onCreate: { kind: 'generator', id: 'instantNow' } }],
    });
  });

  it('set both phases on one field', () => {
    expect(
      executionDefaults(`model Event {
  id        Int      @id
  updatedAt DateTime @onCreate(now()) @onUpdate(now())
}`),
    ).toEqual([
      {
        ref: ref('updatedAt'),
        onCreate: { kind: 'generator', id: 'instantNow' },
        onUpdate: { kind: 'generator', id: 'instantNow' },
      },
    ]);
  });

  it('resolve a field typed by an alias by the codec and params of the alias', () => {
    expect(
      executionDefaults(`types {
  Clock = Time(3)
  Code  = VarChar(64)
}

model Event {
  id     Code  @id @onCreate(uuid())
  seenAt Clock @onUpdate(now())
}`),
    ).toEqual([
      { ref: ref('id'), onCreate: { kind: 'generator', id: 'uuidv4' } },
      {
        ref: ref('seenAt'),
        onUpdate: { kind: 'generator', id: 'plainTimeNow', params: { precision: 3 } },
      },
    ]);
  });

  it('lower uuid() on a VarChar column', () => {
    expect(
      executionDefaults(`model Event {
  id VarChar(64) @id @onCreate(uuid())
}`),
    ).toEqual([{ ref: ref('id'), onCreate: { kind: 'generator', id: 'uuidv4' } }]);
  });

  it('allow a generator on an optional field', () => {
    expect(
      executionDefaults(`model Event {
  id   Int     @id
  code String? @onCreate(ulid())
}`),
    ).toEqual([{ ref: ref('code'), onCreate: { kind: 'generator', id: 'ulid' } }]);
  });

  describe('refuse', () => {
    it('a list field', () => {
      expect(
        diagnostics(`model Event {
  id   Int      @id
  tags String[] @onCreate(uuid())
}`),
      ).toEqual([
        {
          code: 'PSL_LIST_EXECUTION_DEFAULT_UNSUPPORTED',
          message:
            'Field "Event.tags" is a list and cannot use @onCreate(uuid()). Lists have no per-element generated values; remove @onCreate(...).',
        },
      ]);
    });

    it('a function no binding gives the codec', () => {
      expect(
        diagnostics(`model Event {
  id   Int   @id
  data Bytes @onCreate(uuid())
}`),
      ).toEqual([
        {
          code: 'PSL_GENERATOR_NOT_APPLICABLE',
          message:
            'Field "Event.data": uuid() does not apply to codec "pg/bytea@1". No generator function applies to this codec.',
        },
      ]);
    });

    it('a function bound to other codecs, naming the ones that apply', () => {
      expect(
        diagnostics(`model Event {
  id     Int     @id
  seenAt Time(3) @onCreate(uuid())
}`),
      ).toEqual([
        {
          code: 'PSL_GENERATOR_NOT_APPLICABLE',
          message:
            'Field "Event.seenAt": uuid() does not apply to codec "pg/time-temporal@1". Functions that apply: now().',
        },
      ]);
    });

    it('an unknown function, naming the ones that apply', () => {
      expect(
        diagnostics(`model Event {
  id String @id @onCreate(foo())
}`),
      ).toEqual([
        {
          code: 'PSL_UNKNOWN_GENERATOR_FUNCTION',
          message:
            'Field "Event.id": unknown generator function "foo". Functions that apply: cuid(), ksuid(), nanoid(), ulid(), uuid().',
        },
      ]);
    });

    it('a nanoid size longer than a VarChar column', () => {
      expect(
        diagnostics(`model Event {
  id VarChar(10) @id @onCreate(nanoid(16))
}`),
      ).toEqual([
        {
          code: 'PSL_GENERATOR_NOT_APPLICABLE',
          message:
            'Field "Event.id": nanoid(16) writes 16 characters, more than the VarChar(10) column holds.',
        },
      ]);
    });
  });
});
