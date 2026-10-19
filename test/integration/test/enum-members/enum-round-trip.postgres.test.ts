import { int4Column } from '@internal/adapter-postgres/column-types';
import postgresAdapterControl from '@internal/adapter-postgres/control';
import type { Contract, JsonValue } from '@internal/contract/types';
import postgresDriverControl from '@internal/driver-postgres/control';
import arktypeJsonControl from '@internal/extension-arktype-json/control';
import arktypeJsonPack from '@internal/extension-arktype-json/pack';
import pgvectorControl from '@internal/extension-pgvector/control';
import pgvectorPack from '@internal/extension-pgvector/pack';
import postgisControl from '@internal/extension-postgis/control';
import postgisPack from '@internal/extension-postgis/pack';
import sqlFamilyControl from '@internal/family-sql/control';
import { enumRefusalOf, readContractValue } from '@internal/framework-components/codec';
import { createControlStack } from '@internal/framework-components/control';
import {
  defineContract,
  type EnumTypeHandle,
  enumType,
  field,
  member,
  model,
} from '@internal/postgres/contract-builder';
import type { SqlStorage } from '@internal/sql-contract/types';
import postgresTargetControl from '@internal/target-postgres/control';
import { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import { describe, expect, it } from 'vitest';
import { timeouts, withPostgresPort } from '../_harness/postgres';
import { enumNameOf, tableNameOf } from './enum-name-of';
import { literalOf } from './literal-of';
import { sameValue } from './same-value';

const stack = createControlStack({
  family: sqlFamilyControl,
  target: postgresTargetControl,
  adapter: postgresAdapterControl,
  driver: postgresDriverControl,
  extensions: [pgvectorControl, postgisControl, arktypeJsonControl],
});

/** The stored form of one member for each data type a codec an enum can use represents. */
const storedMembers: Readonly<Record<string, JsonValue>> = {
  'pg/char': 'a',
  'pg/varchar': 'low',
  'pg/text': 'low',
  'pg/int2': 7,
  'pg/int4': 7,
  'pg/int8': '9007199254740991',
  'pg/float4': 1.5,
  'pg/float8': 2.25,
  'pg/numeric': '12',
  'pg/date': '2024-01-02',
  'pg/timestamp': '2024-01-02T03:04:05.5',
  'pg/timestamptz': '2024-01-02T03:04:05.5Z',
  'pg/time': '03:04:05.5',
  'pg/bool': true,
  'pg/bit': '1',
  'pg/varbit': '101',
  'pg/uuid': 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'pg/inet': '10.0.0.0/8',
  'pg/interval': 'P1Y2M3DT4H5M6.5S',
  'pg/text-array': ['low', 'high'],
};

/** The codecs an enum accepts whose enum the contract build still refuses, with its message: a member stored as neither a string nor a finite number, which the column check that enforces membership cannot list. */
const authoringRefusals: Readonly<Record<string, string>> = {
  'pg/bool@1':
    'enumType("PgBool1"): CHECK constraint members must encode to strings or finite numbers.',
  'pg/text-array@1':
    'enumType("PgTextArray1"): CHECK constraint members must encode to strings or finite numbers.',
};

const refused = stack.codecDescriptors.flatMap((descriptor) => {
  const refusal = enumRefusalOf(descriptor);
  return refusal === undefined ? [] : [{ codecId: descriptor.codecId, refusal }];
});

/** The extension packs whose codecs the stack registers. The contract the round trip pushes declares none, because the runtime the harness composes has none, and every extension codec is refused. */
const extensionPacks = {
  pgvector: pgvectorPack,
  postgis: postgisPack,
  arktypeJson: arktypeJsonPack,
};

function contractWith(
  enums: Record<string, EnumTypeHandle>,
  extensions: Partial<typeof extensionPacks> = extensionPacks,
) {
  return defineContract({
    extensions,
    enums,
    models: Object.fromEntries(
      Object.entries(enums).map(([name, handle]) => [
        name,
        model(name, {
          fields: { id: field.column(int4Column).id(), value: field.namedType(handle) },
        }).sql({ table: tableNameOf(name) }),
      ]),
    ),
  });
}

/** The enum on a codec, with one member stored as `stored`, or why the contract build refuses it. */
function enumOn(
  codecId: string,
  stored: JsonValue,
): { readonly handle: EnumTypeHandle } | { readonly refusal: string } {
  try {
    const codec = stack.codecLookup.forCodecRef({ codecId });
    const handle = enumType(
      enumNameOf(codecId),
      { codecId },
      member('Only', readContractValue(codec, stored, undefined)),
    );
    contractWith({ [handle.enumName]: handle });
    return { handle };
  } catch (error) {
    return { refusal: error instanceof Error ? error.message : String(error) };
  }
}

const accepted = stack.codecDescriptors
  .filter((descriptor) => enumRefusalOf(descriptor) === undefined)
  .map((descriptor) => ({
    codecId: descriptor.codecId,
    dataType: descriptor.dataType,
    built: enumOn(descriptor.codecId, storedMembers[descriptor.dataType] ?? null),
  }));
const refusedOnBuild = accepted.flatMap(({ codecId, built }) =>
  'refusal' in built ? [[codecId, built.refusal] as const] : [],
);
const roundTripped = accepted.flatMap(({ codecId, dataType, built }) =>
  'handle' in built
    ? [{ codecId, handle: built.handle, stored: storedMembers[dataType] ?? null }]
    : [],
);

const contractJson = new PostgresContractSerializer().serializeContract(
  contractWith(Object.fromEntries(roundTripped.map(({ handle }) => [handle.enumName, handle])), {}),
);

describe('every codec an enum can use on Postgres reads back the member it writes', () => {
  it('has a stored member for the data type of every codec an enum can use', () => {
    expect(new Set(accepted.map(({ dataType }) => dataType))).toEqual(
      new Set(Object.keys(storedMembers)),
    );
  });

  it.each(refused)('refuses an enum on $codecId with its reason', ({ codecId, refusal }) => {
    expect(() =>
      contractWith({ Refused: enumType('Refused', { codecId }, member('Only', 'only')) }),
    ).toThrow(refusal);
  });

  it('refuses, when the contract is built, each other enum it cannot store in a checked column', () => {
    expect(Object.fromEntries(refusedOnBuild)).toEqual(authoringRefusals);
  });

  it.each(roundTripped)(
    'writes the member of an enum on $codecId past the column check, reads back the member, and renders the literal of the value read',
    ({ codecId, handle: { enumName }, stored }) =>
      withPostgresPort<Contract<SqlStorage>>({ contractJson }, async ({ client }) => {
        const enumAccessor = client.enums['public']?.[enumName];
        const collection = client.orm['public']?.[enumName];
        if (enumAccessor === undefined || collection === undefined) {
          expect.unreachable(`the client has the enum and model ${enumName}`);
        }
        const written = enumAccessor.members['Only'];
        await collection.createAndCount([{ id: 1, value: written }]);
        const row = await collection.first();

        expect({
          has: enumAccessor.has(row?.['value']),
          equal: sameValue(row?.['value'], written),
          literal: stack.codecLookup.renderValueLiteralFor?.(codecId, stored, 'output'),
        }).toEqual({ has: true, equal: true, literal: literalOf(row?.['value']) });
      }),
    timeouts.spinUpPpgDev,
  );
});
