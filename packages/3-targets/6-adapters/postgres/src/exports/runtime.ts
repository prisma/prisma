import type { GeneratedValueSpec } from '@prisma-next/contract/types';
import { timestampNowRuntimeGenerator } from '@prisma-next/family-sql/runtime';
import type { RuntimeAdapterInstance } from '@prisma-next/framework-components/execution';
import { builtinGeneratorIds } from '@prisma-next/ids';
import { generateId } from '@prisma-next/ids/runtime';
import type { Adapter, AnyQueryAst } from '@prisma-next/sql-relational-core/ast';
import type { SqlRuntimeAdapterDescriptor } from '@prisma-next/sql-runtime';
import { postgresCodecRegistry } from '@prisma-next/target-postgres/codecs';
import { createPostgresAdapterWithCodecRegistry, postgresRawCodecInferer } from '../core/adapter';
import { assemblePostgresCodecRegistry } from '../core/codec-lookup';
import { postgresAdapterDescriptorMeta, postgresQueryOperations } from '../core/descriptor-meta';
import type { PostgresContract, PostgresLoweredStatement } from '../core/types';

export interface SqlRuntimeAdapter
  extends RuntimeAdapterInstance<'sql', 'postgres'>,
    Adapter<AnyQueryAst, PostgresContract, PostgresLoweredStatement> {}

function createPostgresMutationDefaultGenerators() {
  return [
    ...builtinGeneratorIds.map((id) => ({
      id,
      generate: (params?: Record<string, unknown>) => {
        const spec: GeneratedValueSpec = params ? { id, params } : { id };
        return generateId(spec);
      },
      stability: 'field' as const,
    })),
    timestampNowRuntimeGenerator(),
  ];
}

const postgresRuntimeAdapterDescriptor: SqlRuntimeAdapterDescriptor<'postgres', SqlRuntimeAdapter> =
  {
    ...postgresAdapterDescriptorMeta,
    codecs: () => Array.from(postgresCodecRegistry.values()),
    queryOperations: () => postgresQueryOperations(),
    mutationDefaultGenerators: createPostgresMutationDefaultGenerators,
    rawCodecInferer: postgresRawCodecInferer,
    create(stack): SqlRuntimeAdapter {
      const components = [stack.target, stack.adapter, ...stack.extensions];
      const codecRegistry = assemblePostgresCodecRegistry(components);
      return createPostgresAdapterWithCodecRegistry(codecRegistry);
    },
  };

export default postgresRuntimeAdapterDescriptor;
