import type { ContractField } from '@internal/contract/types';
import { nonEmptyTypeParams } from '@internal/sql-contract/types';
import { ifDefined } from '@internal/utils/defined';
import {
  isValueObjectMember,
  type ScalarMemberNode,
  type ValueObjectMemberNode,
} from './contract-definition';
import { enumValueSetRefs } from './enum-members';

export function buildDomainField(
  field: ScalarMemberNode | ValueObjectMemberNode,
  defaultNamespaceId: string,
): ContractField {
  if (isValueObjectMember(field)) {
    return {
      type: { kind: 'valueObject', name: field.valueObjectName },
      nullable: field.nullable,
      many: field.many ? { elementNullable: field.elementNullable === true } : false,
    };
  }

  return {
    type: {
      kind: 'scalar',
      codecId: field.descriptor.codecId,
      ...ifDefined('typeParams', nonEmptyTypeParams(field.descriptor.typeParams)),
    },
    nullable: field.nullable,
    many: field.many ? { elementNullable: field.elementNullable === true } : false,
    ...ifDefined('valueSet', enumValueSetRefs(field.enumTypeHandle, defaultNamespaceId)?.domain),
  };
}
