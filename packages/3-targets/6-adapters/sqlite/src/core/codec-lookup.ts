import type { ComponentMetadata } from '@prisma-next/framework-components/components';
import { extractCodecLookup } from '@prisma-next/framework-components/control';
import {
  type AnySqliteCodecDescriptor,
  buildSqliteCodecDescriptorRegistry,
} from '@prisma-next/target-sqlite/codec-descriptor';
import { sqliteCodecDescriptorRegistry } from '@prisma-next/target-sqlite/codecs';
import type { SqliteCodecRegistry } from './types';

type CodecContributor = Pick<ComponentMetadata, 'types'>;

function descriptorsFrom(contributors: ReadonlyArray<CodecContributor>): readonly unknown[] {
  return contributors.flatMap(
    (contributor) => contributor.types?.codecTypes?.codecDescriptors ?? [],
  );
}

function buildSqliteCodecRegistry(descriptors: ReadonlyArray<unknown>): SqliteCodecRegistry {
  const descriptorRegistry = buildSqliteCodecDescriptorRegistry(descriptors);
  const validatedDescriptors = Array.from(descriptorRegistry.values());
  const codecRegistry = extractCodecLookup([
    {
      id: 'sqlite-codecs',
      types: { codecTypes: { codecDescriptors: validatedDescriptors } },
    },
  ]);
  const registry: SqliteCodecRegistry = {
    ...codecRegistry,
    descriptorFor: (codecId) => descriptorRegistry.descriptorFor(codecId),
    values: () => descriptorRegistry.values(),
  };
  return Object.freeze(registry);
}

export function assembleSqliteCodecRegistry(
  target: CodecContributor,
  extensions: ReadonlyArray<CodecContributor>,
): SqliteCodecRegistry {
  return buildSqliteCodecRegistry([
    ...descriptorsFrom([target]),
    ...sqliteCodecDescriptorRegistry.values(),
    ...descriptorsFrom(extensions),
  ]);
}

export function createSqliteCodecRegistryWithBuiltins(
  codecDescriptors: readonly AnySqliteCodecDescriptor[] = [],
): SqliteCodecRegistry {
  return buildSqliteCodecRegistry([...sqliteCodecDescriptorRegistry.values(), ...codecDescriptors]);
}

/**
 * Build a coherent SQLite codec registry populated with built-in descriptors only.
 *
 * The returned registry supports both ordinary codec materialization and SQLite target behavior. Stack-composed paths build the same combined registry from target, full adapter, and ordered extension contributions.
 */
export function createSqliteBuiltinCodecLookup(): SqliteCodecRegistry {
  return createSqliteCodecRegistryWithBuiltins();
}
