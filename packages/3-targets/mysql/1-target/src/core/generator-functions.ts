import {
  idGeneratorFunctionBindings,
  sqlIntegerArgumentGeneratorFunctions,
} from '@internal/family-sql/pack';
import { TIMESTAMP_NOW_GENERATOR_ID } from '@internal/framework-components/authoring';
import type {
  GeneratorFunctionContribution,
  MutationDefaultGeneratorDescriptor,
} from '@internal/framework-components/components';
import { singleGeneratorBinding } from '@internal/framework-components/components';
import { MYSQL_DATETIME_CODEC_ID, MYSQL_TEXT_CODEC_ID } from './codec-ids';
import { mysqlInt } from './data-types';

export const mysqlGeneratorFunctions = [
  ...sqlIntegerArgumentGeneratorFunctions({ integer: mysqlInt.id }),
  {
    name: 'now',
    bindings: [
      singleGeneratorBinding({
        codecIds: [MYSQL_DATETIME_CODEC_ID],
        generatorId: TIMESTAMP_NOW_GENERATOR_ID,
      }),
    ],
  },
  ...idGeneratorFunctionBindings({ text: [MYSQL_TEXT_CODEC_ID] }),
] as const satisfies readonly GeneratorFunctionContribution[];

/** The `now` generator MySQL binds. The SQL family registers the identifier generators. */
export const mysqlGeneratorDescriptors: readonly MutationDefaultGeneratorDescriptor[] = [
  { id: TIMESTAMP_NOW_GENERATOR_ID },
];
