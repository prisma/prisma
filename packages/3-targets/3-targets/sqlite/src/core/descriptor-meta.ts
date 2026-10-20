import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import type { CodecTypes } from '../exports/codec-types';
import { sqliteAuthoringFieldPresets, sqliteAuthoringTypes } from './authoring';
import { sqliteDataTypeEntries } from './data-type-entries';
import { sqliteTargetDescriptorMetaRuntime } from './descriptor-meta-runtime';
import { sqliteGeneratorDescriptors, sqliteGeneratorFunctions } from './generator-functions';

const sqliteTargetDescriptorMetaBase = {
  ...sqliteTargetDescriptorMetaRuntime,
  defaultNamespaceId: UNBOUND_NAMESPACE_ID,
  supportsNamespaces: false,
  authoring: {
    type: sqliteAuthoringTypes,
    field: sqliteAuthoringFieldPresets,
    dataTypes: sqliteDataTypeEntries(),
  },
  generatorFunctions: sqliteGeneratorFunctions,
  controlMutationDefaults: {
    defaultFunctionRegistry: new Map(),
    generatorDescriptors: sqliteGeneratorDescriptors,
  },
} as const;

export const sqliteTargetDescriptorMeta: typeof sqliteTargetDescriptorMetaBase & {
  readonly __codecTypes?: CodecTypes;
} = sqliteTargetDescriptorMetaBase;
