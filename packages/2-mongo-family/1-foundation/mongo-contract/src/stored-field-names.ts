import type { ContractField } from '@internal/contract/types';

const DOCUMENT_ID = '_id';

interface FieldsOf {
  readonly fields: Record<string, ContractField>;
}

/** The key a field of `model` is stored under in its documents. A field is stored under its own name. */
export function storedFieldNameOf(_model: FieldsOf, fieldName: string): string {
  return fieldName;
}

/** The field of `model` stored as `_id`, with its name, or undefined when the model leaves `_id` out. */
export function documentIdFieldOf(
  model: FieldsOf,
): { readonly name: string; readonly field: ContractField } | undefined {
  for (const [name, field] of Object.entries(model.fields)) {
    if (storedFieldNameOf(model, name) === DOCUMENT_ID) return { name, field };
  }
  return undefined;
}

/** Whether `model` stores a field under the stored name `storedName`. */
export function storesField(model: FieldsOf, storedName: string): boolean {
  return Object.keys(model.fields).some((name) => storedFieldNameOf(model, name) === storedName);
}
