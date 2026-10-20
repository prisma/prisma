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
import { SQLITE_DATETIME_CODEC_ID, SQLITE_TEXT_CODEC_ID } from './codec-ids';
import { sqliteInteger } from './data-types';

export const sqliteGeneratorFunctions = [
  ...sqlIntegerArgumentGeneratorFunctions({ integer: sqliteInteger.id }),
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
] as const satisfies readonly GeneratorFunctionContribution[];

/** The `now` generator SQLite binds. The SQL family registers the identifier generators. */
export const sqliteGeneratorDescriptors: readonly MutationDefaultGeneratorDescriptor[] = [
  { id: TIMESTAMP_NOW_GENERATOR_ID },
];
