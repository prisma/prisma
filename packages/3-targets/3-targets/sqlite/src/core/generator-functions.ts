import { idGeneratorFunctionBindings } from '@internal/family-sql/control';
import { TIMESTAMP_NOW_GENERATOR_ID } from '@internal/framework-components/authoring';
import type { GeneratorFunctionContribution } from '@internal/framework-components/control';
import { singleGeneratorBinding } from '@internal/framework-components/control';
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
  ...idGeneratorFunctionBindings({ fixedLength: [], variableLength: [SQLITE_TEXT_CODEC_ID] }),
];
