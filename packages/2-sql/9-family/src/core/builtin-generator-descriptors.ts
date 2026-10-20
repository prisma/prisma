import type { DataTypeId } from '@internal/framework-components/codec';
import type { MutationDefaultGeneratorDescriptor } from '@internal/framework-components/control';
import { builtinGeneratorRegistryMetadata } from '@internal/ids';

/**
 * The descriptors of the built-in ID generators on a SQL target: each writes text, so it applies to the stack's text data types, and a generator that writes a UUID also applies to the target's `uuid` data types.
 */
export function sqlBuiltinGeneratorDescriptors({
  uuid,
}: {
  readonly uuid: readonly DataTypeId[];
}): readonly MutationDefaultGeneratorDescriptor[] {
  return builtinGeneratorRegistryMetadata.map(({ id, writesUuid, writtenLength }) => ({
    id,
    writesText: true,
    applicableDataTypes: writesUuid ? uuid : [],
    writtenLength,
  }));
}
