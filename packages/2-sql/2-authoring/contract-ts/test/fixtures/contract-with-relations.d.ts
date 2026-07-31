// Contract type definitions for contract-with-relations.json

import type { Contract as BaseContract } from '@internal/contract/types';
import type { ContractWithTypeMaps, TypeMaps as TypeMapsType } from '@internal/sql-contract/types';
// Minimal CodecTypes for testing - matches adapter-postgres structure
type CodecTypes = {
  readonly 'pg/int4@1': { output: number };
  readonly 'pg/text@1': { output: string };
  readonly 'pg/timestamptz@1': { output: string };
};

// Contract type representing the contract data structure with relations
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
      readonly post: {
        readonly columns: {
          readonly id: { readonly nativeType: 'int4'; readonly codecId: 'pg/int4@1'; readonly nullable: false };
          readonly title: { readonly nativeType: 'text'; readonly codecId: 'pg/text@1'; readonly nullable: false };
          readonly userId: { readonly nativeType: 'int4'; readonly codecId: 'pg/int4@1'; readonly nullable: false };
          readonly createdAt: { readonly nativeType: 'timestamptz'; readonly codecId: 'pg/timestamptz@1'; readonly nullable: false };
        };
        readonly primaryKey: { readonly columns: readonly ['id'] };
        readonly uniques: ReadonlyArray<never>;
        readonly indexes: ReadonlyArray<never>;
        readonly foreignKeys: ReadonlyArray<never>;
      };
    };
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
      readonly relations: {
        readonly posts: {
          readonly to: { readonly namespace: '__unbound__'; readonly model: 'Post' };
          readonly cardinality: '1:N';
          readonly on: {
            readonly localFields: readonly ['id'];
            readonly targetFields: readonly ['userId'];
          };
        };
      };
    };
    readonly Post: {
      readonly storage: {
        readonly table: 'post';
        readonly fields: {
          readonly id: { readonly column: 'id' };
          readonly title: { readonly column: 'title' };
          readonly userId: { readonly column: 'userId' };
          readonly createdAt: { readonly column: 'createdAt' };
        };
      };
      readonly fields: {
        readonly id: {
          readonly type: { readonly kind: 'scalar'; readonly codecId: 'pg/int4@1' };
          readonly nullable: false;
        };
        readonly title: {
          readonly type: { readonly kind: 'scalar'; readonly codecId: 'pg/text@1' };
          readonly nullable: false;
        };
        readonly userId: {
          readonly type: { readonly kind: 'scalar'; readonly codecId: 'pg/int4@1' };
          readonly nullable: false;
        };
        readonly createdAt: {
          readonly type: { readonly kind: 'scalar'; readonly codecId: 'pg/timestamptz@1' };
          readonly nullable: false;
        };
      };
      readonly relations: {
        readonly user: {
          readonly to: { readonly namespace: '__unbound__'; readonly model: 'User' };
          readonly cardinality: 'N:1';
          readonly on: {
            readonly localFields: readonly ['userId'];
            readonly targetFields: readonly ['id'];
          };
        };
      };
    };
  }
>, TypeMaps>;

export type { CodecTypes };

export type OperationTypes = Record<string, never>;

export type TypeMaps = TypeMapsType<CodecTypes, OperationTypes>;

// Direct model exports for easy importing
export type User = Contract['models']['User'];
export type Post = Contract['models']['Post'];
