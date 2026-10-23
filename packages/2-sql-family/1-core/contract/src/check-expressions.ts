import type {
  ContractValueObject,
  ContractValueObjectField,
  ContractWithDomain,
  EntityCoordinate,
} from '@internal/contract/types';
import { valueObjectAt } from '@internal/contract/types';
import type { CheckKind } from '@internal/sql-schema-ir/naming';
import { invariant } from '@internal/utils/assertions';
import { isStorageValueSet } from './ir/storage-value-set';

/** A value object with each nested value object inlined, as the target's check renderer reads it. */
export interface ResolvedValueObject {
  readonly fields: Readonly<Record<string, ResolvedValueObjectField>>;
}

export interface ResolvedValueObjectField {
  readonly nullable: boolean;
  readonly many: false | { readonly elementNullable: boolean };
  readonly type: ResolvedValueObjectFieldType;
}

/**
 * `values` holds the stored values of the value set an enum member refers to. `anyObject` stands where a value object that contains itself refers back into itself: any object is accepted there, as the MongoDB validator does.
 */
export type ResolvedValueObjectFieldType =
  | {
      readonly kind: 'scalar';
      readonly codecId: string;
      readonly values: readonly (string | number)[] | undefined;
    }
  | { readonly kind: 'valueObject'; readonly valueObject: ResolvedValueObject }
  | { readonly kind: 'anyObject' };

/** One column's shape, as the contract builder hands it to a target's check renderer. */
export interface CheckExpressionInput {
  readonly tableName: string;
  readonly columnName: string;
  readonly many: false | { readonly elementNullable: boolean };
  /** The values a column typed by a domain enum, or a discriminator column, may hold. */
  readonly memberValues: readonly (string | number)[] | undefined;
  /** The value object the column holds, or `undefined` when it holds none. */
  readonly valueObject: ResolvedColumnValueObject | undefined;
}

/** The value object a column holds, with the column's nullability, and whether the column's JSON value is an array of them. */
export interface ResolvedColumnValueObject {
  readonly nullable: boolean;
  readonly many: false | { readonly elementNullable: boolean };
  readonly valueObject: ResolvedValueObject;
}

/** A check the target wants written: what it enforces, the column it constrains, and the predicate body without the surrounding `CHECK (…)`. The family names it. */
export interface CheckExpressionCandidate {
  readonly kind: CheckKind;
  readonly columnName: string;
  readonly expression: string;
}

export type CheckExpressionRenderer = (
  input: CheckExpressionInput,
) => ReadonlyArray<CheckExpressionCandidate>;

/**
 * What the check of a column that holds a value object reads. The contract build and `contract print` both derive it here, so print recognises exactly the check the build writes.
 */
export function resolveColumnValueObject(
  storage: ContractWithDomain['storage'],
  column: {
    readonly reference: EntityCoordinate<'storage', 'valueObject'>;
    readonly nullable: boolean;
    readonly many: false | { readonly elementNullable: boolean };
  },
): ResolvedColumnValueObject {
  return {
    nullable: column.nullable,
    many: column.many,
    valueObject: resolveValueObject(storage, column.reference),
  };
}

/**
 * The value set a discriminator column names (ADR 309): keyed `<Base>.<field>`, and holding the variants' values sorted, so the order variants are declared in does not change the storage hash. The contract build writes it and `contract print` compares a contract's value set with it.
 */
export function discriminatorValueSet(
  baseModelName: string,
  discriminatorField: string,
  variantValues: readonly string[],
): { readonly name: string; readonly values: readonly string[] } {
  return { name: `${baseModelName}.${discriminatorField}`, values: [...variantValues].sort() };
}

/**
 * The value object a reference names, with nested value objects inlined and enum members' values read from their storage value sets.
 */
export function resolveValueObject(
  storage: ContractWithDomain['storage'],
  reference: EntityCoordinate<'storage', 'valueObject'>,
): ResolvedValueObject {
  return resolveEntered(storage, reference, [referenceKey(reference)]);
}

function resolveEntered(
  storage: ContractWithDomain['storage'],
  reference: EntityCoordinate<'storage', 'valueObject'>,
  path: readonly string[],
): ResolvedValueObject {
  const valueObject = requiredValueObject(storage, reference);
  return {
    fields: Object.fromEntries(
      Object.entries(valueObject.fields).map(([name, field]) => [
        name,
        {
          nullable: field.nullable,
          many: field.many ?? false,
          type: resolveFieldType(storage, field, path),
        },
      ]),
    ),
  };
}

function resolveFieldType(
  storage: ContractWithDomain['storage'],
  field: ContractValueObjectField,
  path: readonly string[],
): ResolvedValueObjectFieldType {
  const { type } = field;
  invariant(
    type.kind !== 'union' && field.dict !== true,
    'a SQL value object member is never a union or a dictionary',
  );
  if (type.kind === 'scalar') {
    return {
      kind: 'scalar',
      codecId: type.codecId,
      values: field.valueSet === undefined ? undefined : valueSetValues(storage, field.valueSet),
    };
  }
  const key = referenceKey(type);
  if (reachesAny(storage, type, new Set(path))) return { kind: 'anyObject' };
  return { kind: 'valueObject', valueObject: resolveEntered(storage, type, [...path, key]) };
}

/**
 * Whether `from` refers, through its own fields or nested ones, to a value object on the path being resolved. Each value object on the path refers to `from`, so this holds exactly when `from` is in a group of value objects that contain each other which the path has already entered.
 */
function reachesAny(
  storage: ContractWithDomain['storage'],
  from: EntityCoordinate<'storage', 'valueObject'>,
  targets: ReadonlySet<string>,
): boolean {
  const seen = new Set<string>();
  const pending: EntityCoordinate<'storage', 'valueObject'>[] = [from];
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const key = referenceKey(next);
    if (targets.has(key)) return true;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const field of Object.values(requiredValueObject(storage, next).fields)) {
      if (field.type.kind === 'valueObject') pending.push(field.type);
    }
  }
  return false;
}

function requiredValueObject(
  storage: ContractWithDomain['storage'],
  reference: EntityCoordinate<'storage', 'valueObject'>,
): ContractValueObject {
  const valueObject = valueObjectAt(storage, reference);
  invariant(
    valueObject !== undefined,
    `value object "${reference.entityName}" in namespace "${reference.namespaceId}" is not in storage; the contract validators refuse a reference to a missing value object`,
  );
  return valueObject;
}

function valueSetValues(
  storage: ContractWithDomain['storage'],
  reference: EntityCoordinate<'storage', 'valueSet'>,
): readonly (string | number)[] {
  const valueSet = Object.hasOwn(storage.namespaces, reference.namespaceId)
    ? storage.namespaces[reference.namespaceId]?.entries?.['valueSet']?.[reference.entityName]
    : undefined;
  invariant(
    isStorageValueSet(valueSet),
    `value set "${reference.entityName}" in namespace "${reference.namespaceId}" is not in storage; the contract validators refuse a value object member whose value set is missing`,
  );
  return valueSet.values.filter(
    (value): value is string | number => typeof value === 'string' || typeof value === 'number',
  );
}

function referenceKey(reference: EntityCoordinate<'storage', 'valueObject'>): string {
  return JSON.stringify([reference.namespaceId, reference.entityName]);
}
