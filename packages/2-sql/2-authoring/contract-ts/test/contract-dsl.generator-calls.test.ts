import { gen } from '@internal/framework-components/authoring';
import type { FamilyPackRef, TargetPackRef } from '@internal/framework-components/components';
import {
  type GeneratorFunctionContribution,
  singleGeneratorBinding,
} from '@internal/framework-components/control';
import { describe, expect, it } from 'vitest';
import { createTestSqlNamespace } from '../../../1-core/contract/test/test-support';
import { testTypeLookups } from '../../../1-core/contract/test/test-type-lookups';
import { createComposedAuthoringHelpers } from '../src/composed-authoring-helpers';
import { field, type ScalarFieldBuilder } from '../src/contract-builder';
import { buildContractDefinition } from '../src/contract-lowering';
import { columnDescriptor } from './helpers/column-descriptor';

const generatorFunctions: readonly GeneratorFunctionContribution[] = [
  {
    name: 'uuid',
    signature: { documentation: 'uuid' },
    bindings: [
      {
        codecIds: ['pg/text@1'],
        generatorIds: ['uuidv4', 'uuidv7'],
        resolve: ({ args }) => ({
          ok: true,
          generator: { kind: 'generator', id: args['version'] === 7 ? 'uuidv7' : 'uuidv4' },
        }),
        printArguments: () => undefined,
      },
    ],
  },
  {
    name: 'now',
    signature: { documentation: 'now' },
    bindings: [
      singleGeneratorBinding({
        codecIds: ['pg/time-temporal@1'],
        generatorId: 'plainTimeNow',
        paramsFromColumn: (column) =>
          typeof column.typeParams?.['precision'] === 'number'
            ? { precision: column.typeParams['precision'] }
            : undefined,
      }),
    ],
  },
];

const familyPack: FamilyPackRef<'sql'> = {
  kind: 'family',
  id: 'sql',
  familyId: 'sql',
  version: '0.0.1',
  generatorFunctions,
};

const targetPack: TargetPackRef<'sql', 'postgres'> = {
  kind: 'target',
  id: 'postgres',
  familyId: 'sql',
  targetId: 'postgres',
  version: '0.0.1',
  defaultNamespaceId: 'public',
};

const textColumn = columnDescriptor('pg/text@1');
const byteaColumn = columnDescriptor('pg/bytea@1');
const time3Column = { ...columnDescriptor('pg/time-temporal@1'), typeParams: { precision: 3 } };

const { model } = createComposedAuthoringHelpers({
  ...testTypeLookups,
  family: familyPack,
  target: targetPack,
});

function executionDefaultsOf(fields: Record<string, ScalarFieldBuilder>) {
  const definition = buildContractDefinition({
    family: familyPack,
    target: targetPack,
    createNamespace: createTestSqlNamespace,
    models: { Event: model('Event', { fields }) },
  });
  return Object.fromEntries(
    (definition.models[0]?.fields ?? []).map((node) => [node.fieldName, node.executionDefaults]),
  );
}

describe('.onCreate and .onUpdate', () => {
  it("resolve each call by the field's codec and type params", () => {
    expect(
      executionDefaultsOf({
        id: field.column(textColumn).id().onCreate(gen.uuid(7)),
        seenAt: field.column(time3Column).onUpdate(gen.now()),
        stamped: field.column(time3Column).onCreate(gen.now()).onUpdate(gen.now()),
      }),
    ).toEqual({
      id: { onCreate: { kind: 'generator', id: 'uuidv7' } },
      seenAt: { onUpdate: { kind: 'generator', id: 'plainTimeNow', params: { precision: 3 } } },
      stamped: {
        onCreate: { kind: 'generator', id: 'plainTimeNow', params: { precision: 3 } },
        onUpdate: { kind: 'generator', id: 'plainTimeNow', params: { precision: 3 } },
      },
    });
  });

  it('refuse a function the codec does not bind', () => {
    expect(() =>
      executionDefaultsOf({ id: field.column(byteaColumn).id().onCreate(gen.uuid()) }),
    ).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.DEFAULT_INVALID',
        message:
          'Field "Event.id": uuid() does not apply to codec "pg/bytea@1". No generator function applies to this codec.',
        meta: {
          modelName: 'Event',
          fieldName: 'id',
          codecId: 'pg/bytea@1',
          function: 'uuid',
          reason: 'generator-not-applicable',
        },
      }),
    );
  });

  it('refuse a function no pack declares', () => {
    expect(() =>
      executionDefaultsOf({ id: field.column(textColumn).id().onCreate(gen.ksuid()) }),
    ).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.DEFAULT_INVALID',
        meta: expect.objectContaining({ function: 'ksuid', reason: 'generator-unknown' }),
      }),
    );
  });

  it('refuse a phase set twice', () => {
    expect(() => field.column(textColumn).onCreate(gen.uuid()).onCreate(gen.uuid(7))).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.DEFAULT_INVALID',
        meta: { reason: 'generator-phase-set-twice', phase: 'onCreate' },
      }),
    );
  });

  it('refuse a phase a generated field already sets', () => {
    expect(() =>
      field
        .generated({ type: textColumn, generated: { kind: 'generator', id: 'uuidv4' } })
        .onCreate(gen.uuid()),
    ).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.DEFAULT_INVALID',
        meta: { reason: 'generator-phase-set-twice', phase: 'onCreate' },
      }),
    );
  });

  it('keep a database default beside a generator', () => {
    const definition = buildContractDefinition({
      family: familyPack,
      target: targetPack,
      createNamespace: createTestSqlNamespace,
      models: {
        Event: model('Event', {
          fields: {
            id: field.column(textColumn).id().default('fallback').onCreate(gen.uuid()),
          },
        }),
      },
    });
    const id = definition.models[0]?.fields.find((node) => node.fieldName === 'id');
    expect({ default: id?.default, executionDefaults: id?.executionDefaults }).toEqual({
      default: { kind: 'literal', value: 'fallback' },
      executionDefaults: { onCreate: { kind: 'generator', id: 'uuidv4' } },
    });
  });
});
