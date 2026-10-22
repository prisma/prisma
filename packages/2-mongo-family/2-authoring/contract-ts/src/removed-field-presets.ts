import { answerMissingPropertyReads } from '@internal/contract-authoring';
import { contractError } from './contract-errors';

const GUIDE = 'The upgrade guide "Field presets are removed" lists every rewrite.';

const REWRITES: Readonly<Record<string, string>> = {
  'temporal.createdAt': 'field.date().onCreate(gen.now())',
  'temporal.updatedAt': 'field.date().onCreate(gen.now()).onUpdate(gen.now())',
  'temporal.timestamp':
    'field.date(), with .onCreate(gen.now()) and .onUpdate(gen.now()) for the phases the preset set',
};

function refuse(path: string): never {
  const helper = `field.${path}`;
  const rewrite = Object.hasOwn(REWRITES, path) ? REWRITES[path] : undefined;
  throw contractError(
    'CONTRACT.FIELD_HELPER_UNKNOWN',
    rewrite === undefined
      ? `${helper} does not exist. Prisma 8 removed field presets: declare a field with a codec helper such as field.date() or field.scalar(codecId), and add .onCreate(gen.fn()) and .onUpdate(gen.fn()) for what a preset set. ${GUIDE}`
      : `${helper} was a field preset, and Prisma 8 removed field presets. Write ${rewrite}. ${GUIDE}`,
    { meta: { helper } },
  );
}

/**
 * The MongoDB `field` helpers, where a read of a helper they do not have throws `CONTRACT.FIELD_HELPER_UNKNOWN`. A JavaScript caller, or a contract emitted before it is type-checked, that still calls a removed field preset learns its rewrite; `field.temporal`, which held the presets, gives the rewrite of the preset read from it.
 */
export function refusingRemovedFieldPresets<Helpers extends object>(helpers: Helpers): Helpers {
  return answerMissingPropertyReads(helpers, (name) =>
    name === 'temporal'
      ? answerMissingPropertyReads({}, (member) => refuse(`${name}.${member}`))
      : refuse(name),
  );
}
