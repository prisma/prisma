import type { SqlRuntimeExtensionDescriptor } from '@internal/sql-runtime';
import { pgvectorPackMeta, pgvectorQueryOperations } from '../core/descriptor-meta';
import { pgvectorCodecRegistry } from '../core/registry';

const pgvectorRuntimeDescriptor: SqlRuntimeExtensionDescriptor<'postgres'> = {
  kind: 'extension' as const,
  id: pgvectorPackMeta.id,
  version: pgvectorPackMeta.version,
  familyId: 'sql' as const,
  targetId: 'postgres' as const,
  // Expose the unified descriptor list so `extractCodecLookup` reads `targetTypes` / `renderOutputType` directly off the descriptors and materializes the representative `Codec` for the SQL renderer's cast-policy lookup.
  types: {
    codecTypes: {
      codecDescriptors: Array.from(pgvectorCodecRegistry.values()),
    },
  },
  codecs: () => Array.from(pgvectorCodecRegistry.values()),
  queryOperations: () => pgvectorQueryOperations(),
  create() {
    return {
      familyId: 'sql' as const,
      targetId: 'postgres' as const,
    };
  },
};

export { pgvectorCodecRegistry };
export default pgvectorRuntimeDescriptor;
