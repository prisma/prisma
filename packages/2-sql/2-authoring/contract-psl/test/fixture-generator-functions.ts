import {
  assembleGeneratorFunctions,
  type GeneratorFunctionRegistry,
  singleGeneratorBinding,
} from '@internal/framework-components/control';
import {
  idGeneratorFunctionBindings,
  sqlFamilyGeneratorFunctions,
} from '../../../9-family/src/core/generator-functions';

const nowGeneratorByCodecId: Readonly<
  Record<string, { readonly id: string; readonly precision?: true }>
> = {
  'pg/timestamptz-temporal@1': { id: 'instantNow' },
  'pg/timestamp-temporal@1': { id: 'plainDateTimeNow' },
  'pg/timestamp-string@1': { id: 'timestampStringNow' },
  'pg/timestamptz-date@1': { id: 'timestampNow' },
  'pg/date-temporal@1': { id: 'plainDateNow' },
  'pg/time-temporal@1': { id: 'plainTimeNow', precision: true },
  'pg/time-string@1': { id: 'timeStringNow', precision: true },
  'pg/timetz@1': { id: 'timetzNow', precision: true },
};

/** The SQL family's generator functions with Postgres-like bindings for the fixture codecs. */
export const fixtureGeneratorFunctions: GeneratorFunctionRegistry = assembleGeneratorFunctions([
  { id: 'sql', generatorFunctions: sqlFamilyGeneratorFunctions },
  {
    id: 'postgres',
    generatorFunctions: [
      {
        name: 'now',
        bindings: Object.entries(nowGeneratorByCodecId).map(([codecId, generator]) =>
          singleGeneratorBinding({
            codecIds: [codecId],
            generatorId: generator.id,
            paramsFromColumn: (column) => {
              const precision = column.typeParams?.['precision'];
              return generator.precision === true && typeof precision === 'number'
                ? { precision }
                : undefined;
            },
          }),
        ),
      },
      ...idGeneratorFunctionBindings({
        fixedLength: [],
        variableLength: ['pg/text@1'],
        uuid: ['pg/uuid@1'],
      }),
    ],
  },
]);
