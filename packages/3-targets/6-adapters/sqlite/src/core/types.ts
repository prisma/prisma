import type { Contract } from '@internal/contract/types';
import type { CodecRegistry } from '@internal/framework-components/codec';
import type { SqlStorage } from '@internal/sql-contract/types';
import type { LoweredStatement } from '@internal/sql-relational-core/ast';
import type {
  AnySqliteCodecDescriptor,
  SqliteCodecDescriptorRegistry,
} from '@internal/target-sqlite/codec-descriptor';

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
