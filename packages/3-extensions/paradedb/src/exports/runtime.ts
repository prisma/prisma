import type { SqlRuntimeExtensionDescriptor } from '@internal/sql-runtime';
import { paradedbPackMeta, paradedbQueryOperations } from '../core/descriptor-meta';

const paradedbRuntimeDescriptor: SqlRuntimeExtensionDescriptor<'postgres'> = {
  kind: 'extension' as const,
  id: paradedbPackMeta.id,
  version: paradedbPackMeta.version,
  familyId: 'sql' as const,
  targetId: 'postgres' as const,
  codecs: () => [],
  queryOperations: () => paradedbQueryOperations(),
  create() {
    return {
      familyId: 'sql' as const,
      targetId: 'postgres' as const,
    };
  },
};

export default paradedbRuntimeDescriptor;
