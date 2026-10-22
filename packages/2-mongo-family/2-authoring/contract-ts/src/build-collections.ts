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
import { storedFieldNameIn } from './build-models';
import type { IndexKey, IndexShapeRule, MongoBuildRefusal } from './build-refusals';
import type { FieldNode, IndexNode, ModelNode } from './contract-definition';

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

function isWildcardKey(key: string): boolean {
  return key === '$**' || key.endsWith('.$**');
}

function isTextIndex(index: IndexNode): boolean {
  return Object.values(index.fields).includes('text');
}

/** The first shape rule an index breaks, of those MongoDB enforces when it creates the index. */
function indexShapeProblem(index: IndexNode): IndexShapeRule | undefined {
  const keys = Object.entries(index.fields);
  const hasWildcard = keys.some(([key]) => isWildcardKey(key));
  const directions = keys.map(([, direction]) => direction);
  const options = index.options ?? {};
  if (hasWildcard && options.unique) return 'unique-wildcard';
  if (
    hasWildcard &&
    directions.some((direction) => ['hashed', '2d', '2dsphere'].includes(String(direction)))
  ) {
    return 'wildcard-with-type';
  }
  if (directions.includes('hashed') && keys.length > 1) return 'hashed-several-fields';
  if (hasWildcard && options.expireAfterSeconds !== undefined) return 'ttl-with-wildcard';
  if (!hasWildcard && options.wildcardProjection !== undefined) {
    return 'projection-without-wildcard';
  }
  if (options.collation !== undefined && !options.collation.locale)
    return 'collation-without-locale';
  return undefined;
}

function resolveVariantScope(
  model: ModelNode,
  modelsByName: ReadonlyMap<string, ModelNode>,
  variantValues: ReadonlyMap<string, string>,
): { discriminatorField: string; discriminatorValue: string } | undefined {
  if (!model.base) return undefined;
  const base = modelsByName.get(model.base.model);
  const discriminatorField = base?.discriminator?.field;
  const discriminatorValue = variantValues.get(model.modelName);
  if (base === undefined || !discriminatorField || discriminatorValue === undefined) {
    return undefined;
  }
  return {
    discriminatorField: storedFieldNameIn(base.fields, discriminatorField),
    discriminatorValue,
  };
}

function checkNoCollectionSettings(model: ModelNode, refusals: MongoBuildRefusal[]): void {
  const key = { kind: 'collection', model: model.modelName } as const;
  if (model.indexes && model.indexes.length > 0) {
    refusals.push({ kind: 'collectionSettingWithoutCollection', key, setting: 'indexes' });
  }
  if (model.collectionOptions) {
    refusals.push({
      kind: 'collectionSettingWithoutCollection',
      key,
      setting: 'collectionOptions',
    });
  }
  if (model.controlPolicy) {
    refusals.push({ kind: 'collectionSettingWithoutCollection', key, setting: 'controlPolicy' });
  }
}

/** Each collection the models are stored in, with its indexes, options and control policy. Validators are added later. */
export function buildCollections(input: {
  readonly models: readonly ModelNode[];
  readonly variantValues: ReadonlyMap<string, string>;
  readonly refusals: MongoBuildRefusal[];
}): Record<string, MongoCollectionInput> {
  const { models, variantValues, refusals } = input;
  const intermediate: Record<string, MongoCollectionInput> = {};
  const declaredIndexOwners = new Map<string, string>();
  const textIndexCollections = new Set<string>();
  const modelsByName = new Map(models.map((model) => [model.modelName, model]));

  for (const model of models) {
    const { modelName, collection } = model;
    if (!collection) {
      checkNoCollectionSettings(model, refusals);
      continue;
    }
    const collectionKey = { kind: 'collection', model: modelName } as const;
    const existingCollection: MongoCollectionInput = intermediate[collection] ?? {};
    const existingIndexes = existingCollection.indexes ?? [];

    if (existingCollection.options && model.collectionOptions) {
      refusals.push({
        kind: 'collectionSettingTwice',
        key: collectionKey,
        setting: 'collectionOptions',
        collection,
      });
    }
    if (existingCollection.control !== undefined && model.controlPolicy) {
      refusals.push({
        kind: 'collectionSettingTwice',
        key: collectionKey,
        setting: 'controlPolicy',
        collection,
      });
    }

    const polymorphicScope = resolveVariantScope(model, modelsByName, variantValues);
    const storageIndexes: MongoIndex[] = [];
    (model.indexes ?? []).forEach((written, position) => {
      const key: IndexKey = { kind: 'index', model: modelName, position };
      const signature = canonicalStringify(written);
      const missingField = findMissingIndexField(written, model.fields);
      if (missingField !== undefined) {
        refusals.push({ kind: 'indexFieldUnknown', key, fieldName: missingField, signature });
        return;
      }
      const shapeProblem = indexShapeProblem(written);
      if (shapeProblem !== undefined) {
        refusals.push({ kind: 'indexShape', key, rule: shapeProblem, signature });
        return;
      }
      if (isTextIndex(written)) {
        if (textIndexCollections.has(collection)) {
          refusals.push({ kind: 'indexShape', key, rule: 'second-text-index', signature });
          return;
        }
        textIndexCollections.add(collection);
      }
      const storageIndex = toStorageIndex(written, model.fields);
      const scoped =
        polymorphicScope === undefined
          ? { kind: 'ok' as const, index: storageIndex }
          : applyPolymorphicScopeToMongoIndex(storageIndex, polymorphicScope);
      if (scoped.kind === 'conflict') {
        refusals.push({ kind: 'indexScopeConflict', key, reason: scoped.reason, signature });
        return;
      }
      // Duplicates are found after variant scoping: sibling variants may index the same field, and their scoped indexes differ by partialFilterExpression.
      const collectionIndexKey = `${collection}:${stableStringify(scoped.index)}`;
      const firstModel = declaredIndexOwners.get(collectionIndexKey);
      if (firstModel !== undefined) {
        refusals.push({ kind: 'indexDuplicate', key, collection, firstModel, signature });
        return;
      }
      declaredIndexOwners.set(collectionIndexKey, modelName);
      storageIndexes.push(scoped.index);
    });

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
