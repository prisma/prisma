import {
  type MongoContractRefusal,
  type MongoContractRefusalsInput,
  mongoContractRefusalsOf,
} from '@internal/mongo-contract';
import type { StructuredError } from '@internal/utils/structured-error';
import { contractError } from './contract-errors';

const LIST_THE_CODEC_PACK =
  'List the pack that provides the codec in `extensions` in defineContract.';

function codecRefusalError(
  subject: string,
  meta: Record<string, string>,
  codecId: string,
  refusal: Extract<MongoContractRefusal, { kind: 'fieldBsonType' }>['refusal'],
): StructuredError {
  if (refusal.kind === 'unknownCodec') {
    return contractError('CONTRACT.CODEC_DESCRIPTOR_MISSING', `${subject} ${refusal.reason}`, {
      fix: LIST_THE_CODEC_PACK,
      meta: { ...meta, codecId },
    });
  }
  return contractError('CONTRACT.PACK_CONTRIBUTION_INVALID', `${subject} ${refusal.reason}`, {
    fix: 'Use a codec whose data type is a MongoDB data type, declared with mongoDataType.',
    meta: { ...meta, codecId, dataType: refusal.dataType, reason: 'data-type-not-mongo' },
  });
}

function refusalError(refusal: MongoContractRefusal): StructuredError {
  switch (refusal.kind) {
    case 'embeddedModelHasVariants':
      return contractError(
        'CONTRACT.RELATION_INVALID',
        `Relation "${refusal.modelName}.${refusal.relationName}" ${refusal.reason}`,
        {
          meta: {
            modelName: refusal.modelName,
            relationName: refusal.relationName,
            reason: 'embedded-model-has-variants',
          },
        },
      );
    case 'enumBsonType':
      return codecRefusalError(
        `enumType("${refusal.enumName}")`,
        { enumName: refusal.enumName },
        refusal.codecId,
        refusal.refusal,
      );
    case 'enumNotListable':
      return contractError(
        'CONTRACT.ENUM_INVALID',
        `enumType("${refusal.enumName}") codec "${refusal.codecId}" ${refusal.reason}`,
        {
          meta: {
            enumName: refusal.enumName,
            codecId: refusal.codecId,
            reason: 'not-listable-by-validator',
          },
        },
      );
    case 'enumMemberNotListable':
      return contractError(
        'CONTRACT.ENUM_INVALID',
        `enumType("${refusal.enumName}") member "${refusal.member}" ${refusal.reason}`,
        {
          meta: {
            enumName: refusal.enumName,
            member: refusal.member,
            codecId: refusal.codecId,
            reason: 'member-not-listable-by-validator',
          },
        },
      );
    case 'fieldBsonType': {
      const { owner } = refusal;
      const label = owner.kind === 'model' ? 'Model' : 'Value object';
      const ownerMeta =
        owner.kind === 'model' ? { modelName: owner.name } : { valueObjectName: owner.name };
      return codecRefusalError(
        `${label} "${owner.name}" field "${refusal.fieldName}"`,
        { ...ownerMeta, fieldName: refusal.fieldName },
        refusal.codecId,
        refusal.refusal,
      );
    }
    case 'documentId':
      return contractError(
        'CONTRACT.COLLECTION_INVALID',
        `Model "${refusal.modelName}" field "_id" ${refusal.reason}`,
        {
          meta: {
            modelName: refusal.modelName,
            collection: refusal.collection,
            reason: 'document-id-not-objectId',
          },
        },
      );
  }
}

/**
 * Throws the first part of the built contract that its collection validators cannot describe, as decided by `mongoContractRefusalsOf`.
 */
export function assertCollectionValidatorSources(input: MongoContractRefusalsInput): void {
  const [first] = mongoContractRefusalsOf(input);
  if (first !== undefined) throw refusalError(first);
}
