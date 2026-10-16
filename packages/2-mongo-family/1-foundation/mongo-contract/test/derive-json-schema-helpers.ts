import type { ContractField } from '@internal/contract/types';

export function scalarField(codecId: string, nullable = false): ContractField {
  return { type: { kind: 'scalar', codecId }, nullable, many: false };
}

export function enumField(codecId: string, enumName: string, nullable = false): ContractField {
  return {
    type: { kind: 'scalar', codecId },
    nullable,
    many: false,
    valueSet: {
      plane: 'domain',
      entityKind: 'enum',
      namespaceId: '__unbound__',
      entityName: enumName,
    },
  };
}

export function arrayField(
  codecId: string,
  nullable = false,
  elementNullable = false,
): ContractField {
  return { type: { kind: 'scalar', codecId }, nullable, many: { elementNullable } };
}

export function arrayEnumField(
  codecId: string,
  enumName: string,
  nullable = false,
  elementNullable = false,
): ContractField {
  return {
    type: { kind: 'scalar', codecId },
    nullable,
    many: { elementNullable },
    valueSet: {
      plane: 'domain',
      entityKind: 'enum',
      namespaceId: '__unbound__',
      entityName: enumName,
    },
  };
}

export function voField(name: string, nullable = false): ContractField {
  return { type: { kind: 'valueObject', name }, nullable, many: false };
}

export function voArrayField(
  name: string,
  nullable = false,
  elementNullable = false,
): ContractField {
  return { type: { kind: 'valueObject', name }, nullable, many: { elementNullable } };
}
