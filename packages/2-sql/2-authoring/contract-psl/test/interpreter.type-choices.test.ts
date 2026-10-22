import type {
  AuthoringContributions,
  AuthoringTypeNamespace,
} from '@internal/framework-components/authoring';
import { describe, expect, it } from 'vitest';
import { postgresNativeScalarTypeDescriptors, postgresScalarAuthoringTypes } from './fixtures';
import { sqlStorageFromSuccessfulSqlInterpretation } from './interpret-sql-contract-storage';
import {
  builtinControlMutationDefaults,
  interpretPostgresSchema,
} from './interpreter-defaults-support';
import { unboundTables } from './unbound-tables';

const precision = {
  kind: 'value',
  dataType: 'pg/int4',
  name: 'precision',
  optional: true,
} as const;

const types = {
  ...postgresScalarAuthoringTypes,
  TimestampString: {
    kind: 'typeConstructor',
    args: [precision],
    output: {
      codecId: 'pg/timestamp-string@1',
      typeParams: { precision: { kind: 'arg', index: 0 } },
    },
  },
  DateTemporal: { kind: 'typeConstructor', output: { codecId: 'pg/date-temporal@1' } },
  DateString: { kind: 'typeConstructor', output: { codecId: 'pg/date-string@1' } },
  Moment: {
    kind: 'typeChoice',
    args: [
      {
        kind: 'option',
        name: 'value',
        values: ['temporal', 'string'],
        default: 'temporal',
        optional: true,
      },
      { kind: 'option', name: 'column', values: ['tz', 'local'], default: 'tz', optional: true },
      precision,
    ],
    choices: [
      {
        when: { value: 'temporal', column: 'tz' },
        type: 'TimestamptzTemporal',
        defaults: { precision: 3 },
      },
      { when: { value: 'temporal', column: 'local' }, type: 'TimestampTemporal' },
      { when: { value: 'string', column: 'local' }, type: 'TimestampString' },
    ],
  },
  Day: {
    kind: 'typeChoice',
    args: [
      {
        kind: 'option',
        name: 'value',
        values: ['string', 'temporal'],
        default: 'string',
        optional: true,
      },
      precision,
    ],
    choices: [
      { when: { value: 'string' }, type: 'DateString' },
      { when: { value: 'temporal' }, type: 'DateTemporal' },
    ],
  },
  Label: {
    kind: 'typeChoice',
    args: [
      {
        kind: 'option',
        name: 'value',
        values: ['text', 'number'],
        default: 'text',
        optional: true,
      },
    ],
    choices: [
      { when: { value: 'text' }, type: 'String' },
      { when: { value: 'number' }, type: 'Int' },
    ],
  },
} satisfies AuthoringTypeNamespace;

const authoringContributions = {
  entityTypes: {},
  field: {},
  pslBlockDescriptors: {},
  modelAttributes: {},
  type: types,
} satisfies AuthoringContributions;

function interpret(schema: string) {
  return interpretPostgresSchema(schema, {
    scalarColumnDescriptors: postgresNativeScalarTypeDescriptors,
    controlMutationDefaults: builtinControlMutationDefaults,
    authoringContributions,
  });
}

function lowered(schema: string) {
  const result = interpret(schema);
  if (!result.ok) throw new Error(JSON.stringify(result.failure.diagnostics, null, 2));
  return {
    tables: unboundTables(sqlStorageFromSuccessfulSqlInterpretation(result.value)),
    defaults: result.value.execution?.mutations.defaults ?? [],
  };
}

function diagnostics(schema: string) {
  const result = interpret(schema);
  if (result.ok) throw new Error('expected the schema to be refused');
  return result.failure.diagnostics.map(({ code, message, span }) => ({
    code,
    message,
    columns: [span?.start.column, span?.end.column],
  }));
}

const model = (...fields: readonly string[]) =>
  ['model T {', '  id Int @id', ...fields.map((field) => `  ${field}`), '}'].join('\n');

describe('a type choice in a field type', () => {
  it('emits what writing the type it chooses emits, bare, named and positional', () => {
    expect(
      lowered(
        model(
          'bare Moment',
          'named Moment(value: string, column: local)',
          'positional Moment(temporal, local, 6)',
          'day Day(value: temporal)',
          'list Moment[]',
          'maybe Moment?',
        ),
      ),
    ).toEqual(
      lowered(
        model(
          'bare TimestamptzTemporal(3)',
          'named TimestampString',
          'positional TimestampTemporal(6)',
          'day DateTemporal',
          'list TimestamptzTemporal(3)[]',
          'maybe TimestamptzTemporal(3)?',
        ),
      ),
    );
  });

  it('passes a written precision over the row default', () => {
    expect(lowered(model('at Moment(precision: 6)'))).toEqual(
      lowered(model('at TimestamptzTemporal(6)')),
    );
  });

  it('refuses an unlisted combination at the argument that makes it invalid', () => {
    const line = 'at Moment(value: string, column: tz)';
    const start = '  '.length + line.indexOf('column');
    expect(diagnostics(model(line))).toEqual([
      {
        code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT',
        message:
          'Field "T.at" type "Moment": Argument "column" of Moment cannot be tz when value is string; write one of: local.',
        columns: [start + 1, start + 1 + 'column: tz'.length],
      },
    ]);
  });

  it('refuses a value the option does not list, naming the values it does', () => {
    expect(diagnostics(model('at Day(value: jsDate)'))).toMatchObject([
      {
        code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT',
        message:
          'Field "T.at" type "Day": Argument "value" of Day is jsDate; write one of: string, temporal.',
      },
    ]);
  });

  it('refuses a passed-on argument the chosen type does not take', () => {
    expect(diagnostics(model('at Day(precision: 3)'))).toMatchObject([
      {
        code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT',
        message:
          'Field "T.at" type "Day": Argument "precision" of Day does not apply to DateString, the type that value: string chooses.',
      },
    ]);
  });

  it('refuses a precision the chosen type’s codec refuses, at the precision argument', () => {
    expect(diagnostics(model('at Moment(precision: 7)'))).toMatchObject([
      { code: 'PSL_INVALID_ATTRIBUTE_ARGUMENT' },
    ]);
  });
});

describe('a type choice behind a types {} alias', () => {
  it('emits what the type it chooses emits', () => {
    expect(
      lowered(`types {
  Stamp = Moment(value: string, column: local)
  Plain = Moment
}
${model('stamp Stamp', 'plain Plain')}`),
    ).toEqual(lowered(model('stamp TimestampString', 'plain TimestamptzTemporal(3)')));
  });
});

describe('attributes on a field typed by a type choice', () => {
  it('admit a @default by the codec the call chooses', () => {
    expect(lowered(model('label Label @default("a")'))).toEqual(
      lowered(model('label String @default("a")')),
    );
    expect(diagnostics(model('label Label(value: number) @default("a")'))).toMatchObject([
      { code: 'PSL_VALUE_TYPE_INCOMPATIBLE' },
    ]);
  });

  it('admit a @default by the codec the alias’s call chooses', () => {
    expect(
      diagnostics(`types {
  Count = Label(value: number)
}
${model('count Count @default("a")')}`),
    ).toMatchObject([{ code: 'PSL_VALUE_TYPE_INCOMPATIBLE' }]);
  });

  it('resolve @onCreate and @onUpdate generators for the codec the call chooses', () => {
    expect(
      lowered(
        model(
          'a Moment @onCreate(now()) @onUpdate(now())',
          'b Moment(value: string, column: local) @onCreate(now())',
          'c Day @onCreate(now())',
        ),
      ),
    ).toEqual(
      lowered(
        model(
          'a TimestamptzTemporal(3) @onCreate(now()) @onUpdate(now())',
          'b TimestampString @onCreate(now())',
          'c DateString @onCreate(now())',
        ),
      ),
    );
  });

  it('resolve generators through an alias written as a type choice', () => {
    expect(
      lowered(`types {
  Stamp = Moment(value: string, column: local) @onCreate(now())
}
${model('stamp Stamp')}`),
    ).toEqual(lowered(model('stamp TimestampString @onCreate(now())')));
  });
});
