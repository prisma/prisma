import type { EntityKindDescriptor } from '@prisma-next/framework-components/ir';
import { PostgresNativeEnum, type PostgresNativeEnumInput } from './postgres-native-enum';
import { PostgresRlsEnablement, type PostgresRlsEnablementInput } from './postgres-rls-enablement';
import {
  PostgresRlsPolicy,
  type PostgresRlsPolicyMigrationInput,
  rlsPolicyInputFromFlat,
} from './postgres-rls-policy';
import { PostgresRole, type PostgresRoleInput } from './postgres-role';
import {
  PostgresNativeEnumSchema,
  PostgresRlsEnablementSchema,
  PostgresRlsPolicySchema,
  PostgresRoleSchema,
} from './postgres-validators';

export const policyEntityKind: EntityKindDescriptor<
  PostgresRlsPolicyMigrationInput,
  PostgresRlsPolicy
> = {
  kind: 'policy',
  schema: PostgresRlsPolicySchema,
  // Contract JSON is flat; the conversion validates the name/prefix pair.
  construct: (input) => new PostgresRlsPolicy(rlsPolicyInputFromFlat(input)),
};

export const roleEntityKind: EntityKindDescriptor<PostgresRoleInput, PostgresRole> = {
  kind: 'role',
  schema: PostgresRoleSchema,
  construct: (input) => new PostgresRole(input),
};

export const rlsEnablementEntityKind: EntityKindDescriptor<
  PostgresRlsEnablementInput,
  PostgresRlsEnablement
> = {
  kind: 'rls',
  schema: PostgresRlsEnablementSchema,
  construct: (input) => new PostgresRlsEnablement(input),
};

export const nativeEnumEntityKind: EntityKindDescriptor<
  PostgresNativeEnumInput,
  PostgresNativeEnum
> = {
  kind: 'native_enum',
  schema: PostgresNativeEnumSchema,
  construct: (input) => new PostgresNativeEnum(input),
};
