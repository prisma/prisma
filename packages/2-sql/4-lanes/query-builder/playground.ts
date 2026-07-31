import type { Contract, StorageHashBase } from '@internal/contract/types';
import { createRef, createRoot, type SelectBuilder, type TableReference } from './src';

type StorageHash = StorageHashBase<'storage-hash-example'>;
type AnotherStorageHash = StorageHashBase<'another-storage-hash-example'>;

declare const contract: Contract<{
  readonly storageHash: StorageHash;
  readonly tables: {
    readonly users: {
      readonly columns: {
        readonly id: {
          readonly codecId: 'pg/int8@1';
          readonly nativeType: 'serial';
          nullable: false;
        };
        readonly email: {
          readonly codecId: 'pg/varchar@1';
          readonly nativeType: 'varchar';
          nullable: true;
        };
      };
      readonly foreignKeys: [];
      readonly indexes: [];
      readonly uniques: [];
    };
    readonly posts: {
      readonly columns: {
        readonly id: {
          readonly codecId: 'pg/int8@1';
          readonly nativeType: 'serial';
          nullable: false;
        };
        readonly authorId: {
          readonly codecId: 'pg/int8@1';
          readonly nativeType: 'int8';
          nullable: true;
        };
      };
      readonly foreignKeys: [];
      readonly indexes: [];
      readonly uniques: [];
    };
  };
}>;

declare const wrongTable: TableReference<'comments', StorageHash>;
declare const allTable: TableReference<string, StorageHash>;
// biome-ignore lint/suspicious/noExplicitAny: playground tests type boundary with any table name
declare const anyTable: TableReference<any, StorageHash>;
declare const neverTable: TableReference<never, StorageHash>;
declare const customTable: { '~name': 'users' };
// @ts-expect-error
declare const unknownTable: TableReference<unknown, StorageHash>;
declare const differentHashTable: TableReference<'users', AnotherStorageHash>;

const root = createRoot(contract);
const ref = createRef(contract);

root.from(ref.users).select(ref['*']).build();
root.from(ref.posts).select(ref.posts['*']).build();

// testing multi-table select * type error
(
  root.from(ref.users) as SelectBuilder<
    typeof contract,
    {
      users: (typeof contract)['storage']['tables']['users'];
      posts: (typeof contract)['storage']['tables']['posts'];
    }
  >
)
  .select(ref['*'])
  // @ts-expect-error
  .build();

root
  // @ts-expect-error
  .from(allTable)
  // @ts-expect-error
  .build();
root
  .from(allTable as never)
  // @ts-expect-error
  .build();
root
  .from(allTable as unknown)
  // @ts-expect-error
  .build();
root
  // @ts-expect-error
  .from(anyTable)
  // @ts-expect-error
  .build();
root
  .from(neverTable)
  // @ts-expect-error
  .build();
root
  // @ts-expect-error
  .from(ref.no_such_table)
  // @ts-expect-error
  .build();
root
  // @ts-expect-error
  .from(customTable)
  // @ts-expect-error
  .build();
root
  // @ts-expect-error
  .from(unknownTable)
  // @ts-expect-error
  .build();
root
  // @ts-expect-error
  .from(differentHashTable)
  // @ts-expect-error
  .build();
