// Contract type definitions
// Example: This pattern allows multiple contracts (e.g., authDataContract.d.ts, salesDataContract.d.ts)
// without namespace collisions. Each contract can have its own namespace name.

import type { Contract as BaseContract } from '@internal/contract/types';
import type { ContractWithTypeMaps } from '@internal/sql-contract/types';
// Minimal CodecTypes for testing - matches adapter-postgres structure
type CodecTypes = {
  readonly 'pg/int4@1': { output: number };
  readonly 'pg/text@1': { output: string };
  readonly 'pg/timestamptz@1': { output: string };
};

// Contract type representing the contract data structure
// This type matches the structure of contract.json and can be used as a return type
export type Contract = ContractWithTypeMaps<BaseContract<
  {
    readonly tables: {
      readonly user: {
        readonly columns: {
          readonly id: { readonly nativeType: 'int4'; readonly codecId: 'pg/int4@1'; readonly nullable: false };
          readonly email: { readonly nativeType: 'text'; readonly codecId: 'pg/text@1'; readonly nullable: false };
          readonly createdAt: { readonly nativeType: 'timestamptz'; readonly codecId: 'pg/timestamptz@1'; readonly nullable: false };
        };
        readonly primaryKey: { readonly columns: readonly ['id'] };
        readonly uniques: ReadonlyArray<never>;
        readonly indexes: ReadonlyArray<never>;
        readonly foreignKeys: ReadonlyArray<never>;
      };
    };
    readonly namespaces: { readonly __unbound__: { readonly id: '__unbound__' } };
  },
  {
    readonly User: {
      readonly storage: {
        readonly table: 'user';
        readonly fields: {
          readonly id: { readonly column: 'id' };
          readonly email: { readonly column: 'email' };
          readonly createdAt: { readonly column: 'createdAt' };
        };
      };
      readonly fields: {
        readonly id: {
          readonly type: { readonly kind: 'scalar'; readonly codecId: 'pg/int4@1' };
          readonly nullable: false;
        };
        readonly email: {
          readonly type: { readonly kind: 'scalar'; readonly codecId: 'pg/text@1' };
          readonly nullable: false;
        };
        readonly createdAt: {
          readonly type: { readonly kind: 'scalar'; readonly codecId: 'pg/timestamptz@1' };
          readonly nullable: false;
        };
      };
      readonly relations: Record<string, never>;
    };
  }
>, TypeMaps>;

// Codec type map and scalar mapping imported from adapter - used for type inference in lanes
export type { CodecTypes };

// Operation types (empty for now, can be extended by extension packs)
export type OperationTypes = Record<string, never>;

export type FieldOutputTypes = {
  readonly User: {
    readonly id: number;
    readonly email: string;
    readonly createdAt: string;
  };
};
export type TypeMaps = { readonly codecTypes: CodecTypes; readonly operationTypes: OperationTypes; readonly queryOperationTypes: Record<string, never>; readonly fieldOutputTypes: FieldOutputTypes };

// Direct model exports for easy importing: import type { User } from './contract.d'
export type User = Contract['models']['User'];
