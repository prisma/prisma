import { idGeneratorFunctionBindings } from '@internal/family-sql/pack';
import { TIMESTAMP_NOW_GENERATOR_ID } from '@internal/framework-components/authoring';
import type {
  GeneratorFunctionContribution,
  MutationDefaultGeneratorDescriptor,
} from '@internal/framework-components/components';
import { singleGeneratorBinding } from '@internal/framework-components/components';
import { builtinGeneratorRegistryMetadata } from '@internal/ids';
import { SQLITE_DATETIME_CODEC_ID, SQLITE_TEXT_CODEC_ID } from './codec-ids';

export const sqliteGeneratorFunctions: readonly GeneratorFunctionContribution[] = [
  {
    name: 'now',
    bindings: [
      singleGeneratorBinding({
        codecIds: [SQLITE_DATETIME_CODEC_ID],
        generatorId: TIMESTAMP_NOW_GENERATOR_ID,
      }),
    ],
  },
  ...idGeneratorFunctionBindings({ text: [SQLITE_TEXT_CODEC_ID] }),
];

/** The generators the SQLite generator functions produce, which the stack checks every binding against. */
export const sqliteGeneratorDescriptors: readonly MutationDefaultGeneratorDescriptor[] = [
  ...builtinGeneratorRegistryMetadata,
  { id: TIMESTAMP_NOW_GENERATOR_ID },
];
