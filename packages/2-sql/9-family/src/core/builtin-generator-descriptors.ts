import type { DataTypeId } from '@internal/framework-components/codec';
import type { MutationDefaultGeneratorDescriptor } from '@internal/framework-components/control';
import { builtinGeneratorRegistryMetadata } from '@internal/ids';

/**
 * The descriptors of the built-in ID generators on a SQL target: each applies to the target's `text` data types, and a generator that writes a UUID also to its `uuid` data types.
 */
export function sqlBuiltinGeneratorDescriptors({
  text,
  uuid,
}: {
  readonly text: readonly DataTypeId[];
  readonly uuid: readonly DataTypeId[];
}): readonly MutationDefaultGeneratorDescriptor[] {
  return builtinGeneratorRegistryMetadata.map(({ id, writesUuid }) => ({
    id,
    applicableDataTypes: writesUuid ? [...text, ...uuid] : text,
  }));
}
