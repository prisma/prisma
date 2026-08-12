import type { MongoControlAdapterDescriptor } from '@internal/family-mongo/control-adapter';
import type { AuthoringTypeNamespace } from '@internal/framework-components/authoring';
import type { MongoControlDriverInstance } from '@internal/mongo-lowering';

export { MongoInspectionExecutor } from '../core/inspection-executor';
export { introspectSchema } from '../core/introspect-schema';
export { MongoControlAdapterImpl } from '../core/mongo-control-adapter';
export { isMongoControlDriver } from '../core/mongo-control-driver';
export {
  createMongoRunnerDeps,
  extractDb,
  type MarkerOperations,
  type MongoRunnerDependencies,
} from '../core/runner-deps';
export { createMongoAdapter } from '../mongo-adapter';
export type { MongoControlDriverInstance };

import { MongoControlAdapterImpl } from '../core/mongo-control-adapter';

/**
 * The base PSL scalars as zero-arg type constructors in the unified authoring
 * channel, with explicit `nativeType` values pinned to the codec manifests
 * (`codecLookup.targetTypesFor(codecId)[0]`).
 */
export const mongoScalarAuthoringTypes = {
  String: { kind: 'typeConstructor', output: { codecId: 'mongo/string@1', nativeType: 'string' } },
  Int: { kind: 'typeConstructor', output: { codecId: 'mongo/int32@1', nativeType: 'int' } },
  Boolean: { kind: 'typeConstructor', output: { codecId: 'mongo/bool@1', nativeType: 'bool' } },
  DateTime: { kind: 'typeConstructor', output: { codecId: 'mongo/date@1', nativeType: 'date' } },
  ObjectId: {
    kind: 'typeConstructor',
    output: { codecId: 'mongo/objectId@1', nativeType: 'objectId' },
  },
  Float: { kind: 'typeConstructor', output: { codecId: 'mongo/double@1', nativeType: 'double' } },
} as const satisfies AuthoringTypeNamespace;

export const mongoAdapterDescriptor: MongoControlAdapterDescriptor<'mongo'> = {
  kind: 'adapter',
  id: 'mongo',
  familyId: 'mongo',
  targetId: 'mongo',
  version: '0.0.1',
  authoring: { type: mongoScalarAuthoringTypes },
  types: {
    codecTypes: {
      import: {
        package: '@internal/adapter-mongo/codec-types',
        named: 'CodecTypes',
        alias: 'MongoCodecTypes',
      },
      typeImports: [
        {
          package: '@internal/adapter-mongo/codec-types',
          named: 'Vector',
          alias: 'Vector',
        },
      ],
    },
  },
  create(_stack) {
    return new MongoControlAdapterImpl();
  },
};

export default mongoAdapterDescriptor;
