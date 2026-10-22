import {
  applyPolymorphicScopeToMongoIndex,
  type MongoCollectionInput,
  MongoCollectionOptions,
  type MongoCollectionOptionsAuthoringInput,
  type MongoCollectionOptionsInput,
  MongoIndex,
  type MongoIndexInput,
} from '@internal/mongo-contract';
import { canonicalStringify } from '@internal/utils/canonical-stringify';
import { blindCast } from '@internal/utils/casts';
import { ifDefined } from '@internal/utils/defined';
import { storedDiscriminatorValue, storedFieldNameIn } from './build-models';
import type { FieldNode, IndexNode, ModelNode } from './contract-definition';
import { contractError } from './contract-errors';

/**
 * A key-sorted signature of a storage index, used only to find duplicate indexes. `canonicalStringify` refuses class instances such as `MongoIndex`, so this reads their enumerable properties instead.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function storedIndexKey(fields: readonly FieldNode[], key: string): string {
  const wildcardMatch = key.match(/^(.+)\.\$\*\*$/);
  const scope = wildcardMatch?.[1];
  if (scope !== undefined) return `${storedFieldNameIn(fields, scope)}.$**`;
  return key === '$**' ? key : storedFieldNameIn(fields, key);
}

function toStorageIndex(index: IndexNode, fields: readonly FieldNode[]): MongoIndex {
  const keys = Object.entries(index.fields).map(([field, direction]) => ({
    field: storedIndexKey(fields, field),
    direction,
  }));
  const input: Record<string, unknown> = { keys };
  if (index.options) {
    for (const [key, value] of Object.entries(index.options)) {
      if (value !== undefined) {
        input[key] = value;
      }
    }
  }
  return new MongoIndex(
    blindCast<MongoIndexInput, 'the keys and options above are the MongoIndex input fields'>(input),
  );
}

function toStorageCollectionOptions(
  opts: MongoCollectionOptionsAuthoringInput,
): MongoCollectionOptions {
  const input: MongoCollectionOptionsInput = {
    ...(opts.capped
      ? { capped: { size: opts.size ?? 0, ...(opts.max != null && { max: opts.max }) } }
      : {}),
    ...ifDefined('storageEngine', opts.storageEngine),
    ...ifDefined('indexOptionDefaults', opts.indexOptionDefaults),
    ...ifDefined('collation', opts.collation),
    ...ifDefined('timeseries', opts.timeseries),
    ...(opts.clusteredIndex !== undefined && {
      clusteredIndex:
        opts.clusteredIndex.name !== undefined ? { name: opts.clusteredIndex.name } : {},
    }),
    ...ifDefined('expireAfterSeconds', opts.expireAfterSeconds),
    ...ifDefined('changeStreamPreAndPostImages', opts.changeStreamPreAndPostImages),
  };
  return new MongoCollectionOptions(input);
}

function findMissingIndexField(index: IndexNode, fields: readonly FieldNode[]): string | undefined {
  for (const fieldName of Object.keys(index.fields)) {
    const wildcardMatch = fieldName.match(/^(.+)\.\$\*\*$/);
    const lookupName = wildcardMatch ? wildcardMatch[1] : fieldName;
    if (lookupName === undefined || lookupName.length === 0) continue;
    if (lookupName === '$**') continue;
    if (!fields.some((field) => field.fieldName === lookupName)) {
      return lookupName;
    }
  }
  return undefined;
}

function resolveVariantScope(
  model: ModelNode,
  modelsByName: ReadonlyMap<string, ModelNode>,
): { discriminatorField: string; discriminatorValue: string } | undefined {
  if (!model.base) return undefined;
  const base = modelsByName.get(model.base.model);
  if (!base) return undefined;
  const discriminatorField = base.discriminator?.field;
  const written = model.base.value;
  if (!discriminatorField || written === undefined) return undefined;
  return {
    discriminatorField: storedFieldNameIn(base.fields, discriminatorField),
    discriminatorValue: storedDiscriminatorValue(written),
  };
}

function scopeVariantIndex(
  storageIndex: MongoIndex,
  scope: { discriminatorField: string; discriminatorValue: string },
  variantName: string,
  writtenIndex: IndexNode | undefined,
): MongoIndex {
  const result = applyPolymorphicScopeToMongoIndex(storageIndex, scope);
  if (result.kind === 'conflict') {
    const indexLabel = writtenIndex ? canonicalStringify(writtenIndex) : '<unknown>';
    throw contractError(
      'CONTRACT.INDEX_INVALID',
      `Variant model "${variantName}" index ${indexLabel} conflicts with discriminator scope: ${result.reason}`,
      { meta: { variantName, indexLabel, reason: result.reason } },
    );
  }
  return result.index;
}

function assertNoCollectionSettings(model: ModelNode): void {
  const { modelName } = model;
  if (model.indexes && model.indexes.length > 0) {
    throw contractError(
      'CONTRACT.COLLECTION_INVALID',
      `Model "${modelName}" defines indexes but has no collection to attach them to.`,
      { meta: { modelName, reason: 'indexes-without-collection' } },
    );
  }

  if (model.collectionOptions) {
    throw contractError(
      'CONTRACT.COLLECTION_INVALID',
      `Model "${modelName}" defines collectionOptions but has no collection to attach them to.`,
      { meta: { modelName, reason: 'collectionOptions-without-collection' } },
    );
  }

  if (model.controlPolicy) {
    throw contractError(
      'CONTRACT.COLLECTION_INVALID',
      `Model "${modelName}" defines controlPolicy but has no collection to attach it to.`,
      { meta: { modelName, reason: 'controlPolicy-without-collection' } },
    );
  }
}

/** Each collection the models are stored in, with its indexes, options and control policy. Validators are added later. */
export function buildCollections(
  models: readonly ModelNode[],
): Record<string, MongoCollectionInput> {
  const intermediate: Record<string, MongoCollectionInput> = {};
  const declaredIndexOwners = new Map<string, string>();
  const modelsByName = new Map(models.map((model) => [model.modelName, model]));

  for (const model of models) {
    const { modelName, collection } = model;
    if (!collection) {
      assertNoCollectionSettings(model);
      continue;
    }

    const existingCollection: MongoCollectionInput = intermediate[collection] ?? {};
    const existingIndexes = existingCollection.indexes ?? [];

    if (existingCollection.options && model.collectionOptions) {
      throw contractError(
        'CONTRACT.COLLECTION_INVALID',
        `Collection "${collection}" has collectionOptions declared by multiple models. Author collectionOptions on a single model per collection.`,
        {
          meta: {
            modelName,
            collection,
            reason: 'collectionOptions-declared-by-multiple-models',
          },
        },
      );
    }

    if (existingCollection.control !== undefined && model.controlPolicy) {
      throw contractError(
        'CONTRACT.COLLECTION_INVALID',
        `Collection "${collection}" has controlPolicy declared by multiple models. Author controlPolicy on a single model per collection.`,
        {
          meta: {
            modelName,
            collection,
            reason: 'controlPolicy-declared-by-multiple-models',
          },
        },
      );
    }

    const writtenIndexes = model.indexes ?? [];
    for (const writtenIndex of writtenIndexes) {
      const missingField = findMissingIndexField(writtenIndex, model.fields);
      if (missingField !== undefined) {
        const indexSignature = canonicalStringify(writtenIndex);
        throw contractError(
          'CONTRACT.FIELD_UNKNOWN',
          `Model "${modelName}" index ${indexSignature} references unknown field "${missingField}".`,
          { meta: { modelName, fieldName: missingField, indexSignature } },
        );
      }
    }

    const polymorphicScope = resolveVariantScope(model, modelsByName);
    const rawStorageIndexes = writtenIndexes.map((written) =>
      toStorageIndex(written, model.fields),
    );
    const storageIndexes = polymorphicScope
      ? rawStorageIndexes.map((index, i) =>
          scopeVariantIndex(index, polymorphicScope, modelName, writtenIndexes[i]),
        )
      : rawStorageIndexes;

    // Duplicates are found after variant scoping: sibling variants may index the same field, and their scoped indexes differ by partialFilterExpression.
    for (let i = 0; i < storageIndexes.length; i++) {
      const storageIndex = storageIndexes[i];
      if (storageIndex === undefined) continue;
      const indexSignature = stableStringify(storageIndex);
      const collectionIndexKey = `${collection}:${indexSignature}`;
      const firstOwner = declaredIndexOwners.get(collectionIndexKey);
      if (firstOwner) {
        const writtenIndex = writtenIndexes[i];
        const reportedSignature = writtenIndex ? canonicalStringify(writtenIndex) : indexSignature;
        throw contractError(
          'CONTRACT.NAME_DUPLICATE',
          `Collection "${collection}" defines duplicate index ${reportedSignature}. First declared on model "${firstOwner}" and duplicated on model "${modelName}".`,
          {
            meta: {
              kind: 'index',
              name: reportedSignature,
              collection,
              first: firstOwner,
              second: modelName,
            },
          },
        );
      }
      declaredIndexOwners.set(collectionIndexKey, modelName);
    }
    const storageOptions = model.collectionOptions
      ? toStorageCollectionOptions(model.collectionOptions)
      : undefined;
    const controlPatch = model.controlPolicy !== undefined ? { control: model.controlPolicy } : {};

    intermediate[collection] =
      storageIndexes.length > 0
        ? {
            ...existingCollection,
            indexes: [...existingIndexes, ...storageIndexes],
            ...(storageOptions ? { options: storageOptions } : {}),
            ...controlPatch,
          }
        : storageOptions
          ? { ...existingCollection, options: storageOptions, ...controlPatch }
          : Object.keys(controlPatch).length > 0
            ? { ...existingCollection, ...controlPatch }
            : existingCollection;
  }

  return intermediate;
}
