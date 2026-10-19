import type {
  ContractEnum,
  ContractField,
  ContractModelBase,
  ContractValueObject,
} from '@internal/contract/types';
import { collectionRootModelsOf } from './collection-root-models';
import { documentIdRefusalOf } from './document-id-refusal';
import { type FieldBsonTypeRefusal, fieldBsonTypeRefusalOf } from './field-bson-type-refusal';
import { bsonTypesOfCodec, type MongoTypeLookups } from './mongo-data-type';
import { isEmbedRelation } from './relation-fields';
import { documentIdFieldOf } from './stored-field-names';
import { validatorEnumMemberRefusalOf, validatorEnumRefusalOf } from './validator-enum-refusal';

export type FieldOwner =
  | { readonly kind: 'model'; readonly name: string }
  | { readonly kind: 'valueObject'; readonly name: string };

/**
 * A part of a MongoDB contract its collection validators cannot describe. Each reason leaves out its subject, so each authoring surface leads with its own and raises the refusal in its own error form.
 */
export type MongoContractRefusal =
  | {
      readonly kind: 'embeddedModelHasVariants';
      readonly modelName: string;
      readonly relationName: string;
      readonly embeddedModel: string;
      readonly reason: string;
    }
  | {
      readonly kind: 'enumBsonType';
      readonly enumName: string;
      readonly codecId: string;
      readonly refusal: FieldBsonTypeRefusal;
    }
  | {
      readonly kind: 'enumNotListable';
      readonly enumName: string;
      readonly codecId: string;
      readonly reason: string;
    }
  | {
      readonly kind: 'enumMemberNotListable';
      readonly enumName: string;
      readonly member: string;
      readonly codecId: string;
      readonly reason: string;
    }
  | {
      readonly kind: 'fieldBsonType';
      readonly owner: FieldOwner;
      readonly fieldName: string;
      readonly codecId: string;
      readonly refusal: FieldBsonTypeRefusal;
    }
  | {
      readonly kind: 'documentId';
      readonly modelName: string;
      /** The model's field stored as `_id`. */
      readonly fieldName: string;
      readonly collection: string;
      readonly reason: string;
    };

export interface MongoContractRefusalsInput {
  readonly models: Record<string, ContractModelBase>;
  readonly valueObjects: Record<string, ContractValueObject>;
  readonly enums: Record<string, ContractEnum>;
  readonly lookups: MongoTypeLookups;
}

/** Why an embed relation cannot target `embeddedModel`, a model with variants; the subject is the relation. */
function embeddedVariantsReason(embeddedModel: string): string {
  return `embeds model "${embeddedModel}", which has variants. The ORM reads and writes only the base fields of an embedded model, so an embedded model cannot have variants.`;
}

/**
 * The parts of a MongoDB contract its validators cannot describe that can be decided without codec lookups: an embed relation to a model with variants. `mongoContractRefusalsOf` includes them, and `validateMongoStorage` applies them to a contract read back from `contract.json`.
 */
export function lookupFreeRefusalsOf(
  models: Record<string, ContractModelBase>,
): MongoContractRefusal[] {
  return Object.entries(models).flatMap(([modelName, model]) =>
    Object.entries(model.relations).flatMap(([relationName, relation]): MongoContractRefusal[] =>
      isEmbedRelation(relation) && models[relation.to.model]?.variants !== undefined
        ? [
            {
              kind: 'embeddedModelHasVariants',
              modelName,
              relationName,
              embeddedModel: relation.to.model,
              reason: embeddedVariantsReason(relation.to.model),
            },
          ]
        : [],
    ),
  );
}

function enumRefusals(
  enums: Record<string, ContractEnum>,
  lookups: MongoTypeLookups,
): MongoContractRefusal[] {
  return Object.entries(enums).flatMap(([enumName, { codecId, members }]) => {
    const refusal = fieldBsonTypeRefusalOf(codecId, lookups);
    if (refusal !== undefined) return [{ kind: 'enumBsonType', enumName, codecId, refusal }];
    const bsonTypes = bsonTypesOfCodec(codecId, lookups) ?? [];
    const reason = validatorEnumRefusalOf(bsonTypes);
    if (reason !== undefined) return [{ kind: 'enumNotListable', enumName, codecId, reason }];
    return members.flatMap((member): MongoContractRefusal[] => {
      const memberReason = validatorEnumMemberRefusalOf(bsonTypes, member.value);
      return memberReason === undefined
        ? []
        : [
            {
              kind: 'enumMemberNotListable',
              enumName,
              member: member.name,
              codecId,
              reason: memberReason,
            },
          ];
    });
  });
}

function fieldRefusals(
  owner: FieldOwner,
  fields: Record<string, ContractField>,
  lookups: MongoTypeLookups,
): MongoContractRefusal[] {
  return Object.entries(fields).flatMap(([fieldName, field]): MongoContractRefusal[] => {
    if (field.type.kind !== 'scalar') return [];
    const refusal = fieldBsonTypeRefusalOf(field.type.codecId, lookups);
    return refusal === undefined
      ? []
      : [{ kind: 'fieldBsonType', owner, fieldName, codecId: field.type.codecId, refusal }];
  });
}

function documentIdRefusals(
  models: Record<string, ContractModelBase>,
  lookups: MongoTypeLookups,
): MongoContractRefusal[] {
  return Object.entries(collectionRootModelsOf(models)).flatMap(([collection, modelNames]) =>
    modelNames.flatMap((modelName): MongoContractRefusal[] => {
      const model = models[modelName];
      const id = model === undefined ? undefined : documentIdFieldOf(model);
      const reason = id === undefined ? undefined : documentIdRefusalOf(id.field, lookups);
      return id === undefined || reason === undefined
        ? []
        : [{ kind: 'documentId', modelName, fieldName: id.name, collection, reason }];
    }),
  );
}

/**
 * Every part of a built MongoDB contract that its collection validators cannot describe: an embed relation to a model with variants, an enum a validator cannot list, a field whose codec has no MongoDB data type, and a root model's field stored as `_id` that is not an objectId. Both authoring surfaces call it on what they built, so the rules are decided in one place.
 */
export function mongoContractRefusalsOf(
  input: MongoContractRefusalsInput,
): readonly MongoContractRefusal[] {
  const { models, valueObjects, enums, lookups } = input;
  return [
    ...lookupFreeRefusalsOf(models),
    ...enumRefusals(enums, lookups),
    ...Object.entries(models).flatMap(([name, model]) =>
      fieldRefusals({ kind: 'model', name }, model.fields, lookups),
    ),
    ...Object.entries(valueObjects).flatMap(([name, valueObject]) =>
      fieldRefusals({ kind: 'valueObject', name }, valueObject.fields, lookups),
    ),
    ...documentIdRefusals(models, lookups),
  ];
}
