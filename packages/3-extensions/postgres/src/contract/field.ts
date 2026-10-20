import sqlFamilyPack from '@internal/family-sql/pack';
import { assembleDataTypes } from '@internal/framework-components/codec';
import {
  type ComposedAuthoringHelpers,
  createComposedAuthoringHelpers,
} from '@internal/sql-contract-ts/contract-builder';
import { assemblePostgresCodecRegistryWithBuiltins } from '@internal/target-postgres/codecs';
import postgresPack from '@internal/target-postgres/pack';

const dataTypeLookup = assembleDataTypes([postgresPack]).lookup;

const helpers = createComposedAuthoringHelpers({
  family: sqlFamilyPack,
  target: postgresPack,
  codecLookup: assemblePostgresCodecRegistryWithBuiltins([], dataTypeLookup),
  dataTypeLookup,
});

type PostgresHelpers = ComposedAuthoringHelpers<
  typeof sqlFamilyPack,
  typeof postgresPack,
  undefined
>;

/**
 * The field builders of the `defineContract` callback for Postgres, without extensions: `field.text()`, `field.temporal.timestamptz()`, `field.uuidString()`, and `field.column(columnType)`. Use it outside a contract, for example to declare the fields of a query fragment.
 */
export const field: PostgresHelpers['field'] = helpers.field;

/**
 * The generator function calls of the `defineContract` callback for Postgres, without extensions, for `.onCreate(...)` and `.onUpdate(...)`: `gen.now()`, `gen.uuid(7)`, `gen.cuid(2)`, `gen.ulid()`, `gen.nanoid(16)` and `gen.ksuid()`.
 */
export const gen: PostgresHelpers['gen'] = helpers.gen;
