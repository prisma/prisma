import mongoAdapterControl from '@internal/adapter-mongo/control';
import type { JsonValue } from '@internal/contract/types';
import mongoDriverControl from '@internal/driver-mongo/control';
import { mongoFamilyDescriptor } from '@internal/family-mongo/control';
import { MongoContractSerializer } from '@internal/family-mongo/ir';
import { enumRefusalOf, readContractValue } from '@internal/framework-components/codec';
import { createControlStack } from '@internal/framework-components/control';
import {
  defineContract,
  type EnumTypeHandle,
  enumType,
  field,
  member,
  model,
} from '@internal/mongo/contract-builder';
import mongoStatic, { contractFromJson } from '@internal/mongo/static';
import {
  type AnyMongoTypeMaps,
  type MongoContract,
  type MongoContractWithTypeMaps,
  validatorEnumRefusalOf,
} from '@internal/mongo-contract';
import { isMongoDataType } from '@internal/mongo-contract/data-type';
import { mongoTargetDescriptor as mongoTargetControl } from '@internal/target-mongo/control';
import { describe, expect, it } from 'vitest';
import { timeouts, withMongoPort } from '../_harness/mongo';
import { enumNameOf, tableNameOf } from './enum-name-of';
import { sameValue } from './same-value';

const stack = createControlStack({
  family: mongoFamilyDescriptor,
  target: mongoTargetControl,
  adapter: mongoAdapterControl,
  driver: mongoDriverControl,
  extensions: [],
});

/** The stored form of one member for each data type whose values a collection validator can list. */
const storedMembers: Readonly<Record<string, JsonValue>> = {
  'mongo/string': 'low',
  'mongo/double': 2.25,
  'mongo/int32': 7,
  'mongo/bool': true,
};

function bsonTypesOf(dataTypeId: string): readonly string[] {
  const dataType = stack.dataTypes.lookup.get(dataTypeId);
  if (dataType === undefined || !isMongoDataType(dataType)) {
    throw new Error(`${dataTypeId} is not a registered Mongo data type`);
  }
  return dataType.mongo.bsonTypes;
}

function contractWith(enums: Record<string, EnumTypeHandle>) {
  return defineContract({
    enums,
    models: Object.fromEntries(
      Object.entries(enums).map(([name, handle]) => [
        name,
        model(name, {
          collection: tableNameOf(name),
          fields: { _id: field.objectId(), value: field.namedType(handle) },
        }),
      ]),
    ),
  });
}

const refused = stack.codecDescriptors.flatMap((descriptor) => {
  const refusal = enumRefusalOf(descriptor);
  return refusal === undefined ? [] : [{ codecId: descriptor.codecId, refusal }];
});
const listable = stack.codecDescriptors.filter(
  (descriptor) =>
    enumRefusalOf(descriptor) === undefined &&
    validatorEnumRefusalOf(bsonTypesOf(descriptor.dataType)) === undefined,
);
const roundTripped = listable.map((descriptor) => {
  const codec = stack.codecLookup.forCodecRef({ codecId: descriptor.codecId });
  return {
    codecId: descriptor.codecId,
    dataType: descriptor.dataType,
    handle: enumType(
      enumNameOf(descriptor.codecId),
      { codecId: descriptor.codecId },
      member(
        'Only',
        readContractValue(codec, storedMembers[descriptor.dataType] ?? null, undefined),
      ),
    ),
  };
});

const contract = contractWith(
  Object.fromEntries(roundTripped.map(({ handle }) => [handle.enumName, handle])),
);
const contractJson = new MongoContractSerializer().serializeContract(contract);
type AnyMongoContract = MongoContractWithTypeMaps<MongoContract, AnyMongoTypeMaps>;
const { enums } = mongoStatic({ contract: contractFromJson<AnyMongoContract>(contractJson) });

describe('every codec an enum can use on MongoDB, whose values a collection validator can list, reads back the member it writes', () => {
  it('has a stored member for the data type of every such codec', () => {
    expect(new Set(roundTripped.map(({ dataType }) => dataType))).toEqual(
      new Set(Object.keys(storedMembers)),
    );
  });

  it.each(refused)('refuses an enum on $codecId with its reason', ({ codecId, refusal }) => {
    expect(() =>
      contractWith({ Refused: enumType('Refused', { codecId }, member('Only', 'only')) }),
    ).toThrow(refusal);
  });

  it(
    'writes the member of each enum past the collection validator and reads back the member',
    () =>
      withMongoPort<AnyMongoContract>({ contractJson }, async ({ db, mongoDb }) => {
        const results: Record<string, { has: boolean; equal: boolean }> = {};
        for (const { codecId, handle } of roundTripped) {
          const collectionName = tableNameOf(handle.enumName);
          const enumAccessor = enums[handle.enumName];
          if (enumAccessor === undefined)
            expect.unreachable(`the client has the enum ${handle.enumName}`);
          const written = enumAccessor.members['Only'];
          await db[collectionName]?.create({ value: written });
          const row = await db[collectionName]?.first();
          results[codecId] = {
            has: enumAccessor.has(row?.['value']),
            equal: sameValue(row?.['value'], written),
          };
          await mongoDb.collection(collectionName).deleteMany({});
        }

        expect(results).toEqual(
          Object.fromEntries(
            roundTripped.map(({ codecId }) => [codecId, { has: true, equal: true }]),
          ),
        );
      }),
    timeouts.spinUpMongoMemoryServer,
  );
});
