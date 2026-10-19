import sqlFamilyPack from '@internal/family-sql/pack';
import {
  createGeneratorHelpers,
  type GeneratorHelpersOf,
} from '@internal/framework-components/components';
import sqlitePack from '@internal/target-sqlite/pack';

/**
 * The generator functions of SQLite, without extensions, for `.onCreate(...)` and `.onUpdate(...)`: `gen.uuid(7)`, `gen.nanoid()`, `gen.now()`. The `defineContract` callback's `gen` also holds the functions its extensions declare.
 */
export const gen: GeneratorHelpersOf<typeof sqlFamilyPack | typeof sqlitePack> =
  createGeneratorHelpers([sqlFamilyPack, sqlitePack]);
