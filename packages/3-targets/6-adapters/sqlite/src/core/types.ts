import type { Contract } from '@prisma-next/contract/types';
import type { CodecRegistry } from '@prisma-next/framework-components/codec';
import type { SqlStorage } from '@prisma-next/sql-contract/types';
import type { LoweredStatement } from '@prisma-next/sql-relational-core/ast';
import type {
  AnySqliteCodecDescriptor,
  SqliteCodecDescriptorRegistry,
} from '@prisma-next/target-sqlite/codec-descriptor';

export type SqliteCodecRegistry = CodecRegistry & SqliteCodecDescriptorRegistry;

export interface SqliteAdapterOptions {
  readonly profileId?: string;
  /**
   * Custom SQLite codec descriptors contributed alongside the built-ins.
   * The complete descriptor set is validated at construction and becomes the
   * single source for ordinary codec materialization and target behavior.
   */
  readonly codecDescriptors?: readonly AnySqliteCodecDescriptor[];
}

export type SqliteContract = Contract<SqlStorage> & { readonly target: 'sqlite' };

export type SqliteLoweredStatement = LoweredStatement;
