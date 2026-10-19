import mongoFamilyPack from '@internal/family-mongo/pack';
import {
  createGeneratorHelpers,
  type GeneratorHelpersOf,
} from '@internal/framework-components/components';
import mongoTargetPack from '@internal/target-mongo/pack';

/**
 * The generator functions of MongoDB, without extensions, for `.onCreate(...)` and `.onUpdate(...)`: `gen.uuid(7)`, `gen.nanoid()`, `gen.now()`. The `defineContract` callback's `gen` also holds the functions its extensions declare.
 */
export const gen: GeneratorHelpersOf<typeof mongoFamilyPack | typeof mongoTargetPack> =
  createGeneratorHelpers([mongoFamilyPack, mongoTargetPack]);
