import type { JsonValue } from '@internal/contract/types';
import { InternalError } from '@internal/utils/internal-error';
import { canonicalizeJson } from '../utils/canonicalize-json';
import type { CodecLookupWithDescriptors, CodecRef } from './codec-types';
import type { DataTypeId } from './data-type';

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
 * The refusals of a discriminator: the field must be required, hold one value, and have one of the stack's text data types; and when an enum types it, each variant's value, as the field stores it, must be one of the enum's members. Returns no refusals for a discriminator that is valid.
 */
export function discriminatorRefusals<Key>(input: {
  readonly field: DiscriminatorField;
  readonly baseValues: readonly { readonly key: Key; readonly stored: JsonValue }[];
  readonly codecLookup: Pick<CodecLookupWithDescriptors, 'descriptorFor'>;
  readonly textDataTypes: readonly DataTypeId[];
}): readonly DiscriminatorRefusal<Key>[] {
  const { field, textDataTypes } = input;
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
    const memberKeys = new Set(members.map((member) => canonicalizeJson(member)));
    for (const { key, stored } of input.baseValues) {
      if (!memberKeys.has(canonicalizeJson(stored))) {
        refusals.push({ kind: 'not-a-member', key, stored, members });
      }
    }
  }
  return refusals;
}
