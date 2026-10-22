import {
  type ContributedTypeNamespace,
  contributedTypeAt,
  contributedTypeCodecId,
  type ResolvedTypeConstructorCall,
} from '@internal/psl-parser';
import { argumentsByParameter, printTypeConstructorCall } from '@internal/psl-parser/interpret';

const MONGO_DATE_CODEC_ID = 'mongo/date@1';
const PHASES = ['onCreate', 'onUpdate'] as const;

/** A field preset Prisma 8 removed: the type its rewrite writes, and the rewrite of a call to it. */
interface RemovedFieldPreset {
  readonly type: readonly string[];
  readonly rewrite: (call: ResolvedTypeConstructorCall) => string;
}

function alias(written: string): RemovedFieldPreset {
  return { type: written.split('.'), rewrite: () => `Write ${written}.` };
}

const timestamp: RemovedFieldPreset = {
  type: ['Date'],
  rewrite: (call) => {
    const args = argumentsByParameter(call.args, PHASES);
    if (args === undefined || [...args.values()].some((value) => value !== 'now')) {
      return 'Write Date with @onCreate(now()) and @onUpdate(now()) for the phases the preset set.';
    }
    const attributes = PHASES.filter((phase) => args.has(phase)).map(
      (phase) => ` @${phase}(now())`,
    );
    return `Write Date${attributes.join('')}.`;
  },
};

const REMOVED_FIELD_PRESETS: Readonly<Record<string, RemovedFieldPreset>> = {
  'temporal.createdAt': alias('temporal.CreatedAt'),
  'temporal.updatedAt': alias('temporal.UpdatedAt'),
  'temporal.timestamp': timestamp,
};

/**
 * The refusal of a call to a field preset Prisma 8 removed, naming what to write instead, or `undefined` when the call names no removed preset or `types` has no Mongo date type to write it with.
 */
export function describeRemovedFieldPreset(
  call: ResolvedTypeConstructorCall,
  types: ContributedTypeNamespace,
): string | undefined {
  const path = call.path.join('.');
  const preset = Object.hasOwn(REMOVED_FIELD_PRESETS, path)
    ? REMOVED_FIELD_PRESETS[path]
    : undefined;
  if (preset === undefined) return undefined;
  const replacement = contributedTypeAt(types, preset.type);
  if (replacement === undefined || contributedTypeCodecId(replacement) !== MONGO_DATE_CODEC_ID) {
    return undefined;
  }
  return `${printTypeConstructorCall(call)} was a field preset, and Prisma 8 removed field presets. ${preset.rewrite(call)}`;
}
