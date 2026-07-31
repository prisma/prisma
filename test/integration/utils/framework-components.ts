import postgresAdapter from '@internal/adapter-postgres/control';
import postgresAdapterRuntime from '@internal/adapter-postgres/runtime';
import pgvectorExtension from '@internal/extension-pgvector/control';
import pgvectorExtensionRuntime from '@internal/extension-pgvector/runtime';
import type {
  SqlControlAdapterDescriptor,
  SqlControlExtensionDescriptor,
  SqlControlTargetDescriptor,
} from '@internal/family-sql/control';
import postgresTarget from '@internal/target-postgres/control';
import postgresTargetRuntime from '@internal/target-postgres/runtime';

const targetDescriptor = postgresTarget;
const adapterDescriptor = postgresAdapter;
const pgvectorDescriptor = pgvectorExtension;

export interface SqlDescriptorBundle {
  readonly target: SqlControlTargetDescriptor<'postgres', unknown>;
  readonly adapter: SqlControlAdapterDescriptor<'postgres'>;
  readonly extensions: ReadonlyArray<SqlControlExtensionDescriptor<'postgres'>>;
}

export function getSqlDescriptorBundle(options?: {
  readonly extensions?: ReadonlyArray<SqlControlExtensionDescriptor<'postgres'>>;
}): SqlDescriptorBundle {
  const extensions = options?.extensions ?? [];
  return {
    target: targetDescriptor,
    adapter: adapterDescriptor,
    extensions,
  };
}

export const pgvectorExtensionDescriptor = pgvectorDescriptor;

export const postgresTargetRuntimeDescriptor = postgresTargetRuntime;
export const postgresAdapterRuntimeDescriptor = postgresAdapterRuntime;
export const pgvectorExtensionRuntimeDescriptor = pgvectorExtensionRuntime;
