import sqlFamilyPack from '@internal/family-sql/pack';
import {
  createGeneratorHelpers,
  type GeneratorHelpersOf,
} from '@internal/framework-components/components';
import postgresPack from '@internal/target-postgres/pack';

/**
 * The generator functions of Postgres, without extensions, for `.onCreate(...)` and `.onUpdate(...)`: `gen.uuid(7)`, `gen.nanoid()`, `gen.now()`. The `defineContract` callback's `gen` also holds the functions its extensions declare.
 */
export const gen: GeneratorHelpersOf<typeof sqlFamilyPack | typeof postgresPack> =
  createGeneratorHelpers([sqlFamilyPack, postgresPack]);
