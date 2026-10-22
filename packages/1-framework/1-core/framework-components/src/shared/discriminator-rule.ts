import type { JsonValue } from '@internal/contract/types';
import { InternalError } from '@internal/utils/internal-error';
import type { CodecLookupWithDescriptors, CodecRef } from './codec-types';
import type { DataTypeId } from './data-type';
import { storedValueKey } from './enum-stored-members';
import type { DataTypeSupport } from './written-value';

/** The field a model names as its discriminator, as the rule reads it. */
export interface DiscriminatorField {
  readonly ref: CodecRef;
  readonly nullable: boolean;
  readonly many: boolean;
  /** The stored values of the members of the enum that types the field; `undefined` when no enum types it. */
  readonly enumMembers: readonly JsonValue[] | undefined;
}

/** Why a field cannot be a discriminator, or why a variant's discriminator value is refused. `Key` names the variant a value belongs to. */
export type DiscriminatorRefusal<Key> =
  | { readonly kind: 'optional' }
  | { readonly kind: 'list' }
  | {
      readonly kind: 'not-text';
      readonly dataType: DataTypeId | undefined;
      readonly textDataTypes: readonly DataTypeId[];
    }
  | {
      readonly kind: 'not-a-member';
      readonly key: Key;
      readonly stored: JsonValue;
      readonly members: readonly JsonValue[];
    };

/**
 * The refusals of a discriminator: the field must be required, hold one value, and have one of the stack's text data types; and when an enum types it, each variant's value, as the field stores it, must be one of the enum's members, compared by the field's data type's equality. Returns no refusals for a discriminator that is valid.
 */
export function discriminatorRefusals<Key>(input: {
  readonly field: DiscriminatorField;
  readonly baseValues: readonly { readonly key: Key; readonly stored: JsonValue }[];
  readonly codecLookup: Pick<CodecLookupWithDescriptors, 'descriptorFor'>;
  readonly dataTypes: Pick<DataTypeSupport, 'lookup' | 'textDataTypes'>;
}): readonly DiscriminatorRefusal<Key>[] {
  const { field } = input;
  const textDataTypes = input.dataTypes.textDataTypes ?? [];
  if (textDataTypes.length === 0) {
    throw new InternalError(
      'The stack names no text data types, so no field can be a discriminator; the target names its text types in its authoring contributions.',
    );
  }
  const refusals: DiscriminatorRefusal<Key>[] = [];
  if (field.nullable) refusals.push({ kind: 'optional' });
  if (field.many) refusals.push({ kind: 'list' });
  const dataType = input.codecLookup.descriptorFor(field.ref.codecId)?.dataType;
  if (dataType === undefined || !textDataTypes.includes(dataType)) {
    refusals.push({ kind: 'not-text', dataType, textDataTypes });
  }
  const members = field.enumMembers;
  if (members !== undefined) {
    const equalityKey =
      dataType === undefined ? undefined : input.dataTypes.lookup.get(dataType)?.equalityKey;
    const memberKeys = new Set(members.map((member) => storedValueKey(member, equalityKey)));
    for (const { key, stored } of input.baseValues) {
      if (!memberKeys.has(storedValueKey(stored, equalityKey))) {
        refusals.push({ kind: 'not-a-member', key, stored, members });
      }
    }
  }
  return refusals;
}

/**
 * A discriminator refusal worded for a diagnostic: a refusal of the field at its `@@discriminator`, and a value that is not a member at its `@@base`. Every contract source words the refusals with this.
 */
export function describeDiscriminatorRefusal<Key>(
  refusal: DiscriminatorRefusal<Key>,
  subject: {
    readonly modelName: string;
    readonly fieldName: string;
    /** How the field's type is written, as in `Int`. */
    readonly typeName: string;
    /** The enum that types the field, for a value that is not one of its members. */
    readonly enumName: string | undefined;
    readonly variantName: (key: Key) => string;
  },
): string {
  const field = `Discriminator field "${subject.fieldName}" on model "${subject.modelName}"`;
  switch (refusal.kind) {
    case 'optional':
      return `${field} must be required, but it is optional. Remove the "?"`;
    case 'list':
      return `${field} must hold one value, but it is a list. Remove the "[]"`;
    case 'not-text':
      return `${field} must be text, such as String, but is "${subject.typeName}"`;
    case 'not-a-member':
      return `Model "${subject.variantName(refusal.key)}" declares @@base value ${JSON.stringify(refusal.stored)}, which is not a member of enum "${subject.enumName}", the type of discriminator field "${subject.modelName}.${subject.fieldName}". Write one of: ${refusal.members.map((member) => JSON.stringify(member)).join(', ')}`;
  }
}
