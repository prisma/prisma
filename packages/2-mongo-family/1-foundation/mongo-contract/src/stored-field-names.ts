import type { ContractField, CrossReference } from '@internal/contract/types';
import { InternalError } from '@internal/utils/internal-error';

/** The key MongoDB stores a document's id under. */
export const DOCUMENT_ID = '_id';

/** A model, whose storage records each field's stored key, or a value object, which stores each field under its own name. */
export interface StoredFieldsOwner {
  readonly fields: Record<string, ContractField>;
  readonly storage?: { readonly fields: Readonly<Record<string, { readonly field: string }>> };
}

/** The stored key of each of `owner`'s own fields, keyed by field name. */
export function storedFieldNamesOf(owner: StoredFieldsOwner): Readonly<Record<string, string>> {
  const storage = owner.storage;
  if (storage === undefined) {
    return Object.fromEntries(Object.keys(owner.fields).map((name) => [name, name]));
  }
  return Object.fromEntries(
    Object.keys(owner.fields).map((name) => {
      const entry = Object.hasOwn(storage.fields, name) ? storage.fields[name] : undefined;
      if (entry === undefined) {
        throw new InternalError(`Field "${name}" has no entry in its model's storage.fields`);
      }
      return [name, entry.field];
    }),
  );
}

/** The key `fieldName`, one of `owner`'s own fields, is stored under. */
export function storedFieldNameOf(owner: StoredFieldsOwner, fieldName: string): string {
  const storedNames = storedFieldNamesOf(owner);
  const storedName = Object.hasOwn(storedNames, fieldName) ? storedNames[fieldName] : undefined;
  if (storedName === undefined) {
    throw new InternalError(`Model has no field "${fieldName}"`);
  }
  return storedName;
}

/** The own field of `owner` stored under `storedName`, or undefined when no field is. */
export function fieldOfStoredName(
  owner: StoredFieldsOwner,
  storedName: string,
): string | undefined {
  return Object.entries(storedFieldNamesOf(owner)).find(([, stored]) => stored === storedName)?.[0];
}

/** Whether one of `owner`'s own fields is stored under `storedName`. */
export function storesField(owner: StoredFieldsOwner, storedName: string): boolean {
  return fieldOfStoredName(owner, storedName) !== undefined;
}

/** The field of `model` stored as `_id`, with its name, or undefined when the model leaves `_id` out. */
export function documentIdFieldOf(
  model: StoredFieldsOwner,
): { readonly name: string; readonly field: ContractField } | undefined {
  const name = fieldOfStoredName(model, DOCUMENT_ID);
  const field = name === undefined ? undefined : model.fields[name];
  return name === undefined || field === undefined ? undefined : { name, field };
}

interface HierarchyModel extends StoredFieldsOwner {
  readonly base?: CrossReference;
}

/** The stored key of each field of model `modelName`, its own and those it inherits from its base models, keyed by field name. */
export function hierarchyStoredFieldNamesOf(
  models: Readonly<Record<string, HierarchyModel>>,
  modelName: string,
): Readonly<Record<string, string>> {
  const model = models[modelName];
  if (model === undefined) return {};
  return {
    ...(model.base === undefined ? {} : hierarchyStoredFieldNamesOf(models, model.base.model)),
    ...storedFieldNamesOf(model),
  };
}
