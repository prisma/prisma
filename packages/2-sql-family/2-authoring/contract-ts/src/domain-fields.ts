import type { ContractField, ValueSetRef } from '@internal/contract/types';
import { nonEmptyTypeParams } from '@internal/sql-contract/types';
import { ifDefined } from '@internal/utils/defined';
import {
  isValueObjectMember,
  type ScalarMemberNode,
  type ValueObjectMemberNode,
} from './contract-definition';
import { enumValueSetRefs } from './enum-members';

function buildField(
  field: ScalarMemberNode | ValueObjectMemberNode,
  defaultNamespaceId: string,
  valueSetOf: (refs: {
    readonly domain: ValueSetRef;
    readonly storage: ValueSetRef;
  }) => ValueSetRef,
): ContractField {
  const many = field.many ? { elementNullable: field.elementNullable === true } : false;
  if (isValueObjectMember(field)) {
    return {
      type: {
        kind: 'valueObject',
        plane: 'storage',
        namespaceId: defaultNamespaceId,
        entityKind: 'valueObject',
        entityName: field.valueObjectName,
      },
      nullable: field.nullable,
      many,
    };
  }
  const refs = enumValueSetRefs(field.enumTypeHandle, defaultNamespaceId);
  return {
    type: {
      kind: 'scalar',
      codecId: field.descriptor.codecId,
      ...ifDefined('typeParams', nonEmptyTypeParams(field.descriptor.typeParams)),
    },
    nullable: field.nullable,
    many,
    ...ifDefined('valueSet', refs === undefined ? undefined : valueSetOf(refs)),
  };
}

/** A model field in the domain plane. A value object is referred to by its storage coordinate, an enum by the domain enum. */
export function buildDomainField(
  field: ScalarMemberNode | ValueObjectMemberNode,
  defaultNamespaceId: string,
): ContractField {
  return buildField(field, defaultNamespaceId, (refs) => refs.domain);
}

/** A member of a storage value object. Storage never refers to the domain plane, so an enum member refers to the storage value set. */
export function buildValueObjectMember(
  field: ScalarMemberNode | ValueObjectMemberNode,
  defaultNamespaceId: string,
): ContractField {
  return buildField(field, defaultNamespaceId, (refs) => refs.storage);
}
