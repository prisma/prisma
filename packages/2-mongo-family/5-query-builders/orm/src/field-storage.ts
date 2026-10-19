import { domainModelsAtDefaultNamespace } from '@internal/contract/types';
import {
  hierarchyStoredFieldNamesOf,
  type MongoContract,
  type MongoModelDefinition,
  storedFieldNamesOf,
} from '@internal/mongo-contract';
import { blindCast } from '@internal/utils/casts';
import type { StructuredError } from '@internal/utils/structured-error';
import { ormError } from './orm-errors';

/** A model's fields mapped to the names its documents store them under, and back. */
export interface FieldStorage {
  readonly modelName: string;
  /** Stored name of each field, keyed by field name. */
  readonly storedNames: Readonly<Record<string, string>>;
  /** Field name of each stored name, keyed by stored name. */
  readonly fieldNames: Readonly<Record<string, string>>;
  /** Stored name of each embed relation, keyed by relation name. */
  readonly embedStoredNames: Readonly<Record<string, string>>;
  /** The field storage of the model each embed relation embeds, keyed by relation name. */
  readonly embedded: Readonly<Record<string, FieldStorage>>;
}

export function mongoModels(
  contract: MongoContract,
): Readonly<Record<string, MongoModelDefinition>> {
  return blindCast<
    Readonly<Record<string, MongoModelDefinition>>,
    'the models of a MongoDB contract carry MongoDB model storage'
  >(domainModelsAtDefaultNamespace(contract.domain));
}

function invert(map: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(map).map(([key, value]) => [value, key]));
}

function embedStoredNamesOf(model: MongoModelDefinition): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(model.relations)
      .filter(([, relation]) => !('on' in relation))
      .map(([name]) => [name, model.storage.relations?.[name]?.field ?? name]),
  );
}

/**
 * The fields of model `modelName`, its own and those it inherits, and, when `variantModelName` is given, the fields of that variant.
 */
export function fieldStorageOf(
  contract: MongoContract,
  modelName: string,
  variantModelName?: string,
): FieldStorage {
  return fieldStorageIn(mongoModels(contract), modelName, variantModelName, new Set());
}

function fieldStorageIn(
  models: Readonly<Record<string, MongoModelDefinition>>,
  modelName: string,
  variantModelName: string | undefined,
  enclosing: ReadonlySet<string>,
): FieldStorage {
  const storedNames = {
    ...hierarchyStoredFieldNamesOf(models, modelName),
    ...(variantModelName === undefined ? {} : storedFieldNamesOfModel(models, variantModelName)),
  };
  const model = models[modelName];
  const embedStoredNames = model === undefined ? {} : embedStoredNamesOf(model);
  const inside = new Set([...enclosing, modelName]);
  const embedded = Object.fromEntries(
    Object.keys(embedStoredNames).flatMap((relationName) => {
      const target = model?.relations[relationName]?.to.model;
      return target === undefined || inside.has(target)
        ? []
        : [[relationName, fieldStorageIn(models, target, undefined, inside)]];
    }),
  );
  return {
    modelName,
    storedNames,
    fieldNames: invert(storedNames),
    embedStoredNames,
    embedded,
  };
}

function storedFieldNamesOfModel(
  models: Readonly<Record<string, MongoModelDefinition>>,
  modelName: string,
): Readonly<Record<string, string>> {
  const model = models[modelName];
  return model === undefined ? {} : storedFieldNamesOf(model);
}

/** The refusal of a name a caller passed that is not a field of the model. */
export function callerFieldUnknown(storage: FieldStorage, fieldName: string): StructuredError {
  const unknown = `Model "${storage.modelName}" has no field "${fieldName}"`;
  const fieldForStoredName = Object.hasOwn(storage.fieldNames, fieldName)
    ? storage.fieldNames[fieldName]
    : undefined;
  if (fieldForStoredName !== undefined) {
    return ormError(
      'ORM.FIELD_UNKNOWN',
      `${unknown}. "${fieldName}" is the stored name of field "${fieldForStoredName}"; pass the field name.`,
      { meta: { model: storage.modelName, field: fieldName, fieldForStoredName } },
    );
  }
  return ormError('ORM.FIELD_UNKNOWN', unknown, {
    meta: { model: storage.modelName, field: fieldName },
  });
}

/** The stored name of a field a caller named. A name that is not a field is refused with `ORM.FIELD_UNKNOWN`. */
export function storedNameOfCallerField(storage: FieldStorage, fieldName: string): string {
  const storedName = Object.hasOwn(storage.storedNames, fieldName)
    ? storage.storedNames[fieldName]
    : undefined;
  if (storedName === undefined) throw callerFieldUnknown(storage, fieldName);
  return storedName;
}

/**
 * The stored path of a dot path a caller named: its first segment is a field, or an embed relation, of the model; a value object stores the rest under their own names.
 */
export function storedPathOfCallerPath(storage: FieldStorage, path: string): string {
  const [head = path, ...rest] = path.split('.');
  const embed = Object.hasOwn(storage.embedStoredNames, head)
    ? storage.embedStoredNames[head]
    : undefined;
  if (embed === undefined) return [storedNameOfCallerField(storage, head), ...rest].join('.');
  const embeddedStorage = storage.embedded[head];
  const [next, ...afterNext] = rest;
  if (embeddedStorage === undefined || next === undefined) return [embed, ...rest].join('.');
  if (/^\d+$/.test(next)) {
    return afterNext.length === 0
      ? [embed, next].join('.')
      : [embed, next, storedPathOfCallerPath(embeddedStorage, afterNext.join('.'))].join('.');
  }
  return [embed, storedPathOfCallerPath(embeddedStorage, rest.join('.'))].join('.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function mapEach(
  value: unknown,
  map: (document: Record<string, unknown>) => unknown,
): unknown {
  if (Array.isArray(value))
    return value.map((element) => (isRecord(element) ? map(element) : element));
  return isRecord(value) ? map(value) : value;
}

/** A document of a model as a row of its fields: each stored name under the name of the field that stores it, embedded models likewise, and stored names no field stores left out. */
export function rowOfStoredDocument(
  document: Record<string, unknown>,
  storage: FieldStorage,
  extra: Readonly<Record<string, (value: unknown) => unknown>> = {},
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const relationOfEmbed = invert(storage.embedStoredNames);
  for (const [storedName, value] of Object.entries(document)) {
    const extraKey = Object.hasOwn(extra, storedName) ? extra[storedName] : undefined;
    if (extraKey !== undefined) {
      row[storedName] = extraKey(value);
      continue;
    }
    const fieldName = Object.hasOwn(storage.fieldNames, storedName)
      ? storage.fieldNames[storedName]
      : undefined;
    if (fieldName !== undefined) {
      row[fieldName] = value;
      continue;
    }
    const relationName = Object.hasOwn(relationOfEmbed, storedName)
      ? relationOfEmbed[storedName]
      : undefined;
    if (relationName === undefined) continue;
    const embeddedStorage = storage.embedded[relationName];
    row[relationName] =
      embeddedStorage === undefined
        ? value
        : mapEach(value, (embedded) => rowOfStoredDocument(embedded, embeddedStorage));
  }
  return row;
}

/** A row of a model's fields as the document that stores it, embedded models likewise. */
export function storedDocumentOfRow(
  row: Record<string, unknown>,
  storage: FieldStorage,
): Record<string, unknown> {
  const document: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(row)) {
    const embed = Object.hasOwn(storage.embedStoredNames, name)
      ? storage.embedStoredNames[name]
      : undefined;
    if (embed === undefined) {
      document[storedNameOfCallerField(storage, name)] = value;
      continue;
    }
    const embeddedStorage = storage.embedded[name];
    document[embed] =
      embeddedStorage === undefined
        ? value
        : mapEach(value, (embedded) => storedDocumentOfRow(embedded, embeddedStorage));
  }
  return document;
}

/** The model each included relation reads, keyed by relation name. */
export type IncludedModels = Readonly<Record<string, string>>;

/**
 * Maps each document of model `modelName` to its row. A document of a model with variants is read with the fields of the variant its discriminator value names, unless `variantModelName` already names one; each included relation is read as rows of the model it reads.
 */
export function documentRowMapper(
  contract: MongoContract,
  modelName: string,
  variantModelName: string | undefined,
  includes: IncludedModels = {},
): (document: unknown) => unknown {
  const models = mongoModels(contract);
  const model = models[modelName];
  const base = fieldStorageOf(contract, modelName, variantModelName);
  const discriminator =
    variantModelName === undefined && model?.discriminator !== undefined
      ? base.storedNames[model.discriminator.field]
      : undefined;
  const variants = new Map<string, FieldStorage>();
  const storageOfVariant = (value: unknown): FieldStorage => {
    if (typeof value !== 'string') return base;
    const variantModel = model?.variants?.[value]?.model;
    if (variantModel === undefined) return base;
    const cached = variants.get(variantModel);
    if (cached !== undefined) return cached;
    const storage = fieldStorageOf(contract, modelName, variantModel);
    variants.set(variantModel, storage);
    return storage;
  };
  const extra = Object.fromEntries(
    Object.entries(includes).map(([relationName, target]) => {
      const targetRow = documentRowMapper(contract, target, undefined);
      return [relationName, (value: unknown) => mapEach(value, targetRow)];
    }),
  );
  return (document) => {
    if (!isRecord(document)) return document;
    const storage = discriminator === undefined ? base : storageOfVariant(document[discriminator]);
    return rowOfStoredDocument(document, storage, extra);
  };
}
