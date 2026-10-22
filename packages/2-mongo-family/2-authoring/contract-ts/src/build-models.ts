import {
  type ContractEmbedRelation,
  type ContractField,
  type ContractModel,
  type ContractReferenceRelation,
  type ContractValueObject,
  type CrossReference,
  crossRef,
  type ValueSetRef,
} from '@internal/contract/types';
import { resolveToOneRelationNullable } from '@internal/contract-authoring';
import type { WrittenValue } from '@internal/framework-components/authoring';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { type MongoModelStorage, unsupportedStoredNameReason } from '@internal/mongo-contract';
import { ifDefined } from '@internal/utils/defined';
import { InternalError } from '@internal/utils/internal-error';
import type {
  ContractDefinition,
  FieldNode,
  ModelNode,
  ReferenceRelationNode,
  RelationNode,
  ValueObjectNode,
} from './contract-definition';
import { contractError } from './contract-errors';

export function storedNameOf(field: FieldNode): string {
  return field.storedName ?? field.fieldName;
}

/** The name documents store `fieldName` under, or `fieldName` itself when the fields do not declare it. */
export function storedFieldNameIn(fields: readonly FieldNode[], fieldName: string): string {
  const field = fields.find((candidate) => candidate.fieldName === fieldName);
  return field === undefined ? fieldName : storedNameOf(field);
}

/** The discriminator value a variant's documents store. */
export function storedDiscriminatorValue(written: WrittenValue): string {
  if (written.kind !== 'string') {
    throw new InternalError(`A discriminator value written as ${written.kind} is not read yet.`);
  }
  return written.text;
}

function buildContractField(field: FieldNode): ContractField {
  const valueSet: ValueSetRef | undefined =
    field.enumName === undefined
      ? undefined
      : {
          plane: 'domain',
          entityKind: 'enum',
          namespaceId: UNBOUND_NAMESPACE_ID,
          entityName: field.enumName,
        };

  return {
    type: field.type,
    nullable: field.nullable,
    many: field.many,
    ...ifDefined('valueSet', valueSet),
  };
}

function buildFields(fields: readonly FieldNode[]): Record<string, ContractField> {
  return Object.fromEntries(fields.map((field) => [field.fieldName, buildContractField(field)]));
}

function buildStorageFields(
  modelName: string,
  fields: readonly FieldNode[],
): Record<string, { readonly field: string }> {
  const storageFields: Record<string, { readonly field: string }> = {};
  const fieldsByStoredName = new Map<string, string>();
  for (const field of fields) {
    const { fieldName } = field;
    const storedName = storedNameOf(field);
    const unsupported = unsupportedStoredNameReason(storedName);
    if (unsupported !== undefined) {
      throw contractError(
        'CONTRACT.ARGUMENT_INVALID',
        `Model "${modelName}" field "${fieldName}" ${unsupported}. Give it another stored name.`,
        { meta: { modelName, fieldName, reason: 'stored-name-unsupported' } },
      );
    }
    const existingField = fieldsByStoredName.get(storedName);
    if (existingField !== undefined) {
      throw contractError(
        'CONTRACT.NAME_DUPLICATE',
        `Model "${modelName}" stores both "${existingField}" and "${fieldName}" as "${storedName}".`,
        { meta: { kind: 'field', name: storedName, first: existingField, second: fieldName } },
      );
    }
    fieldsByStoredName.set(storedName, fieldName);
    storageFields[fieldName] = { field: storedName };
  }
  return storageFields;
}

function toOneRelationNullable(
  modelName: string,
  relation: ReferenceRelationNode,
  on: ReferenceRelationNode['on'],
  fields: readonly FieldNode[],
): boolean {
  const { relationName } = relation;
  const location = `Relation "${modelName}.${relationName}"`;
  const ownsForeignKey = relation.cardinality !== '1:1';
  const localFields = ownsForeignKey
    ? on.localFields.map((fieldName) => {
        const localField = fields.find((field) => field.fieldName === fieldName);
        if (localField === undefined) {
          throw contractError(
            'CONTRACT.RELATION_INVALID',
            `${location} joins on local field "${fieldName}", which model "${modelName}" does not declare`,
            { meta: { modelName, relationName, fieldName, reason: 'local-field-unknown' } },
          );
        }
        return localField;
      })
    : [];
  const { nullable, contradiction } = resolveToOneRelationNullable({
    declaredNullable: relation.nullable,
    localFieldNullability: localFields.map((localField) => localField.nullable === true),
    ownsReference: ownsForeignKey,
  });
  if (contradiction !== undefined) {
    throw contractError(
      'CONTRACT.RELATION_INVALID',
      !ownsForeignKey
        ? `${location} is required but does not own the foreign key, so nothing in storage guarantees the related document exists`
        : contradiction === 'declared-optional'
          ? `${location} is optional but every local field it joins on is required`
          : `${location} is required but a local field it joins on is nullable`,
      { meta: { modelName, relationName, reason: 'to-one-nullability-mismatch' } },
    );
  }
  return nullable;
}

function buildRelation(
  modelName: string,
  relation: RelationNode,
  fields: readonly FieldNode[],
): ContractEmbedRelation | ContractReferenceRelation {
  const to = crossRef(relation.toModel, UNBOUND_NAMESPACE_ID);
  const on = relation.on;
  if (on === undefined) {
    return { to, cardinality: relation.cardinality };
  }
  if (relation.cardinality === '1:N') {
    return { to, cardinality: '1:N', on };
  }
  return {
    to,
    cardinality: relation.cardinality,
    nullable: toOneRelationNullable(modelName, relation, on, fields),
    on,
  };
}

function buildRelations(
  model: ModelNode,
): Record<string, ContractEmbedRelation | ContractReferenceRelation> {
  return Object.fromEntries(
    (model.relations ?? []).map((relation) => [
      relation.relationName,
      buildRelation(model.modelName, relation, model.fields),
    ]),
  );
}

export function buildValueObjects(
  valueObjects: readonly ValueObjectNode[] | undefined,
): Record<string, ContractValueObject> {
  const builtValueObjects: Record<string, ContractValueObject> = {};

  for (const valueObject of valueObjects ?? []) {
    if (valueObject.name in builtValueObjects) {
      throw contractError(
        'CONTRACT.NAME_DUPLICATE',
        `Duplicate value object name "${valueObject.name}" in defineContract().`,
        { meta: { kind: 'valueObject', name: valueObject.name } },
      );
    }

    for (const field of valueObject.fields) {
      if (field.storedName !== undefined) {
        throw contractError(
          'CONTRACT.ARGUMENT_INVALID',
          `Value object "${valueObject.name}" field "${field.fieldName}" sets .mongo({ field }), but a field of a value object is stored under its own name.`,
          {
            meta: {
              valueObjectName: valueObject.name,
              fieldName: field.fieldName,
              reason: 'value-object-field-stored-name',
            },
          },
        );
      }
    }
    builtValueObjects[valueObject.name] = { fields: buildFields(valueObject.fields) };
  }

  return builtValueObjects;
}

/** Each variant of `base` with the value that selects it, in the order of the models. */
function variantsOf(
  base: ModelNode,
  models: readonly ModelNode[],
): readonly { readonly variantName: string; readonly value: string }[] {
  return models.flatMap((model) =>
    model.base?.model === base.modelName && model.base.value !== undefined
      ? [{ variantName: model.modelName, value: storedDiscriminatorValue(model.base.value) }]
      : [],
  );
}

function assertUniqueDiscriminatorValues(
  base: ModelNode,
  variants: readonly { readonly variantName: string; readonly value: string }[],
): void {
  const variantNamesByValue = new Map<string, string>();
  for (const { variantName, value } of variants) {
    const existingVariant = variantNamesByValue.get(value);
    if (existingVariant !== undefined) {
      throw contractError(
        'CONTRACT.ARGUMENT_INVALID',
        `Discriminator value "${value}" is used by both "${existingVariant}" and "${variantName}" on base model "${base.modelName}".`,
        {
          meta: {
            modelName: base.modelName,
            value,
            variants: [existingVariant, variantName],
            reason: 'duplicate-discriminator-value',
          },
        },
      );
    }
    variantNamesByValue.set(value, variantName);
  }
}

export function buildModels(
  models: readonly ModelNode[],
): Record<string, ContractModel<MongoModelStorage>> {
  const builtModels: Record<string, ContractModel<MongoModelStorage>> = {};

  for (const model of models) {
    const { modelName } = model;
    if (modelName in builtModels) {
      throw contractError(
        'CONTRACT.NAME_DUPLICATE',
        `Duplicate model name "${modelName}" in defineContract().`,
        { meta: { kind: 'model', name: modelName } },
      );
    }

    const variants = model.discriminator === undefined ? undefined : variantsOf(model, models);
    if (variants !== undefined) assertUniqueDiscriminatorValues(model, variants);

    const storage = {
      ...(model.collection ? { collection: model.collection } : {}),
      fields: buildStorageFields(modelName, model.fields),
      ...ifDefined('relations', model.storageRelations),
    };

    builtModels[modelName] = {
      fields: buildFields(model.fields),
      relations: buildRelations(model),
      storage,
      ...(model.owner ? { owner: model.owner } : {}),
      ...(model.base ? { base: crossRef(model.base.model, UNBOUND_NAMESPACE_ID) } : {}),
      ...ifDefined('discriminator', model.discriminator),
      ...(variants === undefined
        ? {}
        : {
            variants: Object.fromEntries(
              variants.map(({ variantName, value }) => [
                value,
                crossRef(variantName, UNBOUND_NAMESPACE_ID),
              ]),
            ),
          }),
    };
  }

  return builtModels;
}

export function buildRoots(definition: ContractDefinition): Record<string, CrossReference> {
  if (definition.roots !== undefined) {
    return Object.fromEntries(
      Object.entries(definition.roots).map(([rootName, modelName]) => [
        rootName,
        crossRef(modelName, UNBOUND_NAMESPACE_ID),
      ]),
    );
  }
  const roots: Record<string, CrossReference> = {};
  for (const model of definition.models) {
    if (!model.collection || model.owner || model.base) continue;
    roots[model.collection] = crossRef(model.modelName, UNBOUND_NAMESPACE_ID);
  }
  return roots;
}
