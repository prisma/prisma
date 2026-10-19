import type {
  ContractEnum,
  ContractField,
  ContractModelBase,
  ContractValueObject,
} from '@internal/contract/types';
import {
  collectionRootModelsOf,
  documentIdRefusalOf,
  fieldBsonTypeRefusalOf,
  isEmbedRelation,
  validatorEnumMemberRefusalOf,
  validatorEnumRefusalOf,
} from '@internal/mongo-contract';
import { bsonTypesOfCodec, type MongoTypeLookups } from '@internal/mongo-contract/data-type';
import { assertDefined } from '@internal/utils/assertions';
import { contractError } from './contract-errors';

const LIST_THE_CODEC_PACK =
  'List the pack that provides the codec in `extensions` in defineContract.';

function bsonTypesOrRefuse(
  subject: string,
  meta: Record<string, string>,
  codecId: string,
  lookups: MongoTypeLookups,
): readonly string[] {
  const refusal = fieldBsonTypeRefusalOf(codecId, lookups);
  if (refusal?.kind === 'unknownCodec') {
    throw contractError('CONTRACT.CODEC_DESCRIPTOR_MISSING', `${subject} ${refusal.reason}`, {
      fix: LIST_THE_CODEC_PACK,
      meta: { ...meta, codecId },
    });
  }
  if (refusal?.kind === 'notMongoDataType') {
    throw contractError('CONTRACT.PACK_CONTRIBUTION_INVALID', `${subject} ${refusal.reason}`, {
      fix: 'Use a codec whose data type is a MongoDB data type, declared with mongoDataType.',
      meta: { ...meta, codecId, dataType: refusal.dataType, reason: 'data-type-not-mongo' },
    });
  }
  const bsonTypes = bsonTypesOfCodec(codecId, lookups);
  assertDefined(bsonTypes, `Codec "${codecId}" has a MongoDB data type`);
  return bsonTypes;
}

function assertFieldsHaveBsonTypes(
  owner: { readonly label: string; readonly meta: Record<string, string> },
  fields: Record<string, ContractField>,
  lookups: MongoTypeLookups,
): void {
  for (const [fieldName, field] of Object.entries(fields)) {
    if (field.type.kind !== 'scalar') continue;
    bsonTypesOrRefuse(
      `${owner.label} field "${fieldName}"`,
      { ...owner.meta, fieldName },
      field.type.codecId,
      lookups,
    );
  }
}

function assertNoEmbeddedVariants(models: Record<string, ContractModelBase>): void {
  for (const [modelName, model] of Object.entries(models)) {
    for (const [relationName, relation] of Object.entries(model.relations)) {
      if (!isEmbedRelation(relation) || models[relation.to.model]?.variants === undefined) continue;
      throw contractError(
        'CONTRACT.RELATION_INVALID',
        `Relation "${modelName}.${relationName}" embeds model "${relation.to.model}", which has variants. The ORM reads and writes only the base fields of an embedded model, so an embedded model cannot have variants.`,
        { meta: { modelName, relationName, reason: 'embedded-model-has-variants' } },
      );
    }
  }
}

function assertEnumsListable(enums: Record<string, ContractEnum>, lookups: MongoTypeLookups): void {
  for (const [enumName, { codecId, members }] of Object.entries(enums)) {
    const subject = `enumType("${enumName}")`;
    const bsonTypes = bsonTypesOrRefuse(subject, { enumName }, codecId, lookups);
    const refusal = validatorEnumRefusalOf(bsonTypes);
    if (refusal !== undefined) {
      throw contractError('CONTRACT.ENUM_INVALID', `${subject} codec "${codecId}" ${refusal}`, {
        meta: { enumName, codecId, reason: 'not-listable-by-validator' },
      });
    }
    for (const member of members) {
      const memberRefusal = validatorEnumMemberRefusalOf(bsonTypes, member.value);
      if (memberRefusal === undefined) continue;
      throw contractError(
        'CONTRACT.ENUM_INVALID',
        `${subject} member "${member.name}" ${memberRefusal}`,
        {
          meta: {
            enumName,
            member: member.name,
            codecId,
            reason: 'member-not-listable-by-validator',
          },
        },
      );
    }
  }
}

/**
 * Refuses a contract whose collection validators could not describe the documents the ORM stores: an embedded model with variants, an enum a validator cannot list, a field whose codec has no MongoDB data type, and a root model without an `_id` stored as BSON type `objectId`.
 */
export function assertCollectionValidatorSources(input: {
  readonly models: Record<string, ContractModelBase>;
  readonly valueObjects: Record<string, ContractValueObject>;
  readonly enums: Record<string, ContractEnum>;
  readonly lookups: MongoTypeLookups;
}): void {
  const { models, valueObjects, enums, lookups } = input;
  assertNoEmbeddedVariants(models);
  assertEnumsListable(enums, lookups);
  for (const [modelName, model] of Object.entries(models)) {
    assertFieldsHaveBsonTypes(
      { label: `Model "${modelName}"`, meta: { modelName } },
      model.fields,
      lookups,
    );
  }
  for (const [valueObjectName, valueObject] of Object.entries(valueObjects)) {
    assertFieldsHaveBsonTypes(
      { label: `Value object "${valueObjectName}"`, meta: { valueObjectName } },
      valueObject.fields,
      lookups,
    );
  }
  for (const [collection, modelNames] of Object.entries(collectionRootModelsOf(models))) {
    for (const modelName of modelNames) {
      const refusal = documentIdRefusalOf(models[modelName]?.fields ?? {}, lookups);
      if (refusal === undefined) continue;
      throw contractError('CONTRACT.COLLECTION_INVALID', `Model "${modelName}" ${refusal.reason}`, {
        meta: { modelName, collection, reason: 'document-id-not-objectId' },
      });
    }
  }
}
