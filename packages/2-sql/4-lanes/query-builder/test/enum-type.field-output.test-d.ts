import type { StorageHashBase } from '@internal/contract/types';
import type { ContractWithTypeMaps, TypeMaps } from '@internal/sql-contract/types';
import { assertType, expectTypeOf, test } from 'vitest';
import type { ExtractOutputType, TableToSelection } from '../src/selection';

type EnumCodecTypes = {
  'pg/text@1': {
    output: string;
    input: string;
    traits: 'equality' | 'order' | 'textual';
  };
};

type EnumFieldOutputTypes = {
  User: {
    role: 'user' | 'admin';
    status: 'active' | 'inactive' | null;
  };
};

type EnumStorageColumnTypes = {
  __unbound__: {
    User: {
      role: 'user' | 'admin';
      status: 'active' | 'inactive' | null;
      audit_action: 'create' | 'update' | 'delete';
      name: string;
    };
  };
};

type EnumStorageColumnInputTypes = {
  __unbound__: {
    User: {
      role: 'user' | 'admin';
      status: 'active' | 'inactive' | null;
      audit_action: 'create' | 'update' | 'delete';
      name: string;
    };
  };
};

type EnumTypeMaps = TypeMaps<
  EnumCodecTypes,
  Record<string, never>,
  EnumFieldOutputTypes,
  Record<string, never>,
  EnumStorageColumnTypes,
  EnumStorageColumnInputTypes
>;

type EnumStorage = {
  storageHash: StorageHashBase<string>;
  namespaces: {
    __unbound__: {
      id: '__unbound__';
      kind: 'test-sql-namespace';
      entries: {
        table: {
          User: {
            columns: {
              role: { nativeType: 'text'; codecId: 'pg/text@1'; nullable: false };
              status: { nativeType: 'text'; codecId: 'pg/text@1'; nullable: true };
              audit_action: { nativeType: 'text'; codecId: 'pg/text@1'; nullable: false };
              name: { nativeType: 'text'; codecId: 'pg/text@1'; nullable: false };
            };
            primaryKey: { columns: ['role'] };
            uniques: [];
            indexes: [];
            foreignKeys: [];
          };
        };
      };
    };
  };
};

type EnumModels = {
  User: {
    storage: {
      table: 'User';
      fields: {
        role: { column: 'role' };
        status: { column: 'status' };
        name: { column: 'name' };
      };
    };
    fields: {
      role: {
        readonly type: { readonly kind: 'scalar'; readonly codecId: 'pg/text@1' };
        readonly nullable: false;
      };
      status: {
        readonly type: { readonly kind: 'scalar'; readonly codecId: 'pg/text@1' };
        readonly nullable: true;
      };
      name: {
        readonly type: { readonly kind: 'scalar'; readonly codecId: 'pg/text@1' };
        readonly nullable: false;
      };
    };
    relations: Record<string, never>;
  };
};

// Plain object base (not `Omit<Contract<…>>`); `Omit` loses the phantom key.
type EnumContractBase = {
  readonly target: 'postgres';
  readonly targetFamily: 'sql';
  readonly roots: Record<string, never>;
  readonly storage: EnumStorage;
  readonly domain: {
    readonly namespaces: {
      readonly __unbound__: { readonly models: EnumModels };
    };
  };
  readonly capabilities: Record<string, never>;
  readonly extensions: Record<string, never>;
  readonly meta: Record<string, never>;
  readonly profileHash: StorageHashBase<string>;
};

type EnumContract = ContractWithTypeMaps<EnumContractBase, EnumTypeMaps>;

test('query-builder: non-nullable enum column output is value union, not string', () => {
  type RoleOutput = ExtractOutputType<EnumContract, 'User', 'role'>;
  // assertType catches a `never` regression that toEqualTypeOf would silently pass.
  assertType<RoleOutput>('user');
  expectTypeOf<RoleOutput>().toEqualTypeOf<'user' | 'admin'>();
});

test('query-builder: non-nullable enum column output is not bare string', () => {
  type RoleOutput = ExtractOutputType<EnumContract, 'User', 'role'>;
  expectTypeOf<RoleOutput>().not.toEqualTypeOf<string>();
});

test('query-builder: nullable enum column output is value union | null', () => {
  type StatusOutput = ExtractOutputType<EnumContract, 'User', 'status'>;
  expectTypeOf<StatusOutput>().toEqualTypeOf<'active' | 'inactive' | null>();
});

test('query-builder: raw value-set column with no domain field still types as the union (A3)', () => {
  type AuditOutput = ExtractOutputType<EnumContract, 'User', 'audit_action'>;
  assertType<AuditOutput>('create');
  expectTypeOf<AuditOutput>().toEqualTypeOf<'create' | 'update' | 'delete'>();
  expectTypeOf<AuditOutput>().not.toEqualTypeOf<string>();
});

test('query-builder: plain non-enum column output is the codec output', () => {
  type NameOutput = ExtractOutputType<EnumContract, 'User', 'name'>;
  assertType<NameOutput>('any string');
  expectTypeOf<NameOutput>().toEqualTypeOf<string>();
});

test('query-builder: TableToSelection includes enum value union for role column', () => {
  type Selection = TableToSelection<EnumContract, 'User'>;
  type RoleValue = Selection['role']['~output'];
  expectTypeOf<RoleValue>().toEqualTypeOf<'user' | 'admin'>();
});
