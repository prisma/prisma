import { TIMESTAMP_NOW_GENERATOR_ID } from '@internal/framework-components/authoring';
import type { TargetPackRef } from '@internal/framework-components/components';
import {
  singleGeneratorBinding,
  timestampNowControlDescriptor,
} from '@internal/framework-components/control';
import type { CodecTypes, ParameterizedOutputTypesForTypeParams } from '../exports/codec-types';
import { mongoAuthoringFieldPresets } from './authoring';
import { MONGO_DATE_CODEC_ID } from './codec-ids';
import { mongoTargetDescriptorMetaRuntime } from './descriptor-meta-runtime';

const mongoTargetDescriptorMetaBase = {
  ...mongoTargetDescriptorMetaRuntime,
  authoring: {
    field: mongoAuthoringFieldPresets,
  },
  controlMutationDefaults: {
    defaultFunctionRegistry: new Map(),
    generatorDescriptors: [timestampNowControlDescriptor()],
  },
  generatorFunctions: [
    {
      name: 'now',
      signature: { documentation: 'Writes the current time.' },
      bindings: [
        singleGeneratorBinding({
          codecIds: [MONGO_DATE_CODEC_ID],
          generatorId: TIMESTAMP_NOW_GENERATOR_ID,
        }),
      ],
    },
  ],
} as const satisfies TargetPackRef<'mongo', 'mongo'>;

export const mongoTargetDescriptorMeta: typeof mongoTargetDescriptorMetaBase & {
  readonly __codecTypes?: CodecTypes;
  readonly __parameterizedOutputTypes?: ParameterizedOutputTypesForTypeParams;
} = mongoTargetDescriptorMetaBase;
