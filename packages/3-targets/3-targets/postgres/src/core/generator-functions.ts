import { idGeneratorFunctionBindings } from '@internal/family-sql/pack';
import { TIMESTAMP_NOW_GENERATOR_ID } from '@internal/framework-components/authoring';
import type {
  GeneratorFunctionContribution,
  MutationDefaultGeneratorDescriptor,
} from '@internal/framework-components/components';
import { builtinGeneratorRegistryMetadata } from '@internal/ids';
import {
  PG_CHAR_CODEC_ID,
  PG_TEXT_CODEC_ID,
  PG_UUID_CODEC_ID,
  PG_VARCHAR_CODEC_ID,
} from './codec-ids';
import { postgresNowGeneratorControlDescriptors } from './date-time-now-generators';
import { postgresNowGeneratorFunction } from './now-generators';

export const postgresGeneratorFunctions: readonly GeneratorFunctionContribution[] = [
  postgresNowGeneratorFunction,
  ...idGeneratorFunctionBindings({
    text: [PG_CHAR_CODEC_ID, PG_VARCHAR_CODEC_ID, PG_TEXT_CODEC_ID],
    uuid: [PG_UUID_CODEC_ID],
  }),
];

/** The generators the Postgres generator functions produce, which the stack checks every binding against. */
export const postgresGeneratorDescriptors: readonly MutationDefaultGeneratorDescriptor[] = [
  ...builtinGeneratorRegistryMetadata,
  { id: TIMESTAMP_NOW_GENERATOR_ID },
  ...postgresNowGeneratorControlDescriptors(),
];
