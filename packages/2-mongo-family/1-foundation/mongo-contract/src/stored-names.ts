import type {
  ApplicationDomain,
  ContractField,
  ContractValueObject,
} from '@internal/contract/types';
import { blindCast } from '@internal/utils/casts';
import { InternalError } from '@internal/utils/internal-error';
import type { MongoModelDefinition } from './contract-types';

/** The name MongoDB stores a document's id under. */
export const DOCUMENT_ID = '_id';

type StoredNamesModel = Pick<MongoModelDefinition, 'fields' | 'storage'>;

/** The models of namespace `namespaceId` of a validated MongoDB contract, whose storage records the stored name of every field. */
export function mongoModelsOf(
  domain: ApplicationDomain,
  namespaceId: string,
): Readonly<Record<string, MongoModelDefinition>> {
  return blindCast<
    Readonly<Record<string, MongoModelDefinition>>,
    'a validated MongoDB contract gives every model MongoDB model storage'
  >(domain.namespaces[namespaceId]?.models ?? {});
}

/** The stored name of each of `model`'s own fields, keyed by field name. */
export function ownStoredNamesOf(model: StoredNamesModel): Readonly<Record<string, string>> {
  const storageFields = model.storage.fields;
  return Object.fromEntries(
    Object.keys(model.fields).map((name) => {
      const entry = Object.hasOwn(storageFields, name) ? storageFields[name] : undefined;
      if (entry === undefined) {
        throw new InternalError(`Field "${name}" has no entry in its model's storage.fields`);
      }
      return [name, entry.field];
    }),
  );
}

/** The stored name of each field of a value object: its own name, since a value object has no storage block. */
export function valueObjectStoredNamesOf(
  valueObject: Pick<ContractValueObject, 'fields'>,
): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.keys(valueObject.fields).map((name) => [name, name]));
}

/** The stored name of `fieldName`, one of `model`'s own fields. */
export function ownStoredNameOf(model: StoredNamesModel, fieldName: string): string {
  const storedNames = ownStoredNamesOf(model);
  const storedName = Object.hasOwn(storedNames, fieldName) ? storedNames[fieldName] : undefined;
  if (storedName === undefined) {
    throw new InternalError(`Model has no field "${fieldName}"`);
  }
  return storedName;
}

/** The own field of `model` stored under `storedName`, or undefined when no own field is. */
export function ownFieldStoredAs(model: StoredNamesModel, storedName: string): string | undefined {
  return Object.entries(ownStoredNamesOf(model)).find(([, stored]) => stored === storedName)?.[0];
}

/** Whether one of `model`'s own fields is stored under `storedName`. */
export function hasOwnFieldStoredAs(model: StoredNamesModel, storedName: string): boolean {
  return ownFieldStoredAs(model, storedName) !== undefined;
}

/** The field of `model` stored as `_id`, with its name, or undefined when the model leaves `_id` out. */
export function documentIdFieldOf(
  model: StoredNamesModel,
): { readonly name: string; readonly field: ContractField } | undefined {
  const name = ownFieldStoredAs(model, DOCUMENT_ID);
  const field = name === undefined ? undefined : model.fields[name];
  return name === undefined || field === undefined ? undefined : { name, field };
}

/**
 * The stored name of each of `model`'s own embed relations, keyed by relation name: its `storage.relations` entry, or the relation's own name when it has none.
 */
export function ownEmbedStoredNamesOf(
  model: Pick<MongoModelDefinition, 'relations' | 'storage'>,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(model.relations)
      .filter(([, relation]) => !('on' in relation) && !('through' in relation))
      .map(([name]) => [name, model.storage.relations?.[name]?.field ?? name]),
  );
}

/** Model `modelName` followed by its base models, nearest first; empty when the model is not in `models`. */
export function modelAndBasesOf<Model extends Pick<MongoModelDefinition, 'base'>>(
  models: Readonly<Record<string, Model>>,
  modelName: string,
): readonly Model[] {
  const chain: Model[] = [];
  const seen = new Set<string>();
  for (let name: string | undefined = modelName; name !== undefined && !seen.has(name); ) {
    seen.add(name);
    const model: Model | undefined = models[name];
    if (model === undefined) break;
    chain.push(model);
    name = model.base?.model;
  }
  return chain;
}

/** The stored name of each field of model `modelName`, its own and those it inherits from its base models, keyed by field name. */
export function storedNamesOf(
  models: Readonly<Record<string, StoredNamesModel & Pick<MongoModelDefinition, 'base'>>>,
  modelName: string,
): Readonly<Record<string, string>> {
  const chain = [...modelAndBasesOf(models, modelName)].reverse();
  return Object.assign({}, ...chain.map((model) => ownStoredNamesOf(model)));
}
