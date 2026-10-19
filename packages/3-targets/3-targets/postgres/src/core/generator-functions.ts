import { idGeneratorFunctionBindings } from '@internal/family-sql/control';
import type { GeneratorFunctionContribution } from '@internal/framework-components/control';
import {
  PG_CHAR_CODEC_ID,
  PG_TEXT_CODEC_ID,
  PG_UUID_CODEC_ID,
  PG_VARCHAR_CODEC_ID,
} from './codec-ids';
import { postgresNowGeneratorFunction } from './now-generators';

export const postgresGeneratorFunctions: readonly GeneratorFunctionContribution[] = [
  postgresNowGeneratorFunction,
  ...idGeneratorFunctionBindings({
    fixedLength: [PG_CHAR_CODEC_ID],
    variableLength: [PG_VARCHAR_CODEC_ID, PG_TEXT_CODEC_ID],
    uuid: [PG_UUID_CODEC_ID],
  }),
];
