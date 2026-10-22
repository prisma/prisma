import { argumentsByParameter, printTypeConstructorCall } from './call-arguments';
import {
  type ContributedTypeNamespace,
  contributedTypeAt,
  contributedTypeCodecId,
} from './contributed-type-scope';
import type { ResolvedTypeConstructorCall } from './resolve';

/**
 * A field preset Prisma 8 removed, and how to write what it stored. The preset is named only where `type` resolves, and to `codecId` when one is given, so a row does not fire on a target the preset never existed on.
 */
export interface RemovedFieldPreset {
  readonly type: readonly string[];
  readonly codecId?: string;
  readonly rewrite: (call: ResolvedTypeConstructorCall) => string;
}

/** A family's removed field presets, keyed by the path a schema called. */
export type RemovedFieldPresets = Readonly<Record<string, RemovedFieldPreset>>;

const PHASES = ['onCreate', 'onUpdate'] as const;

/** A preset whose rewrite is always `written`, such as `sql.Char(36) @id @onCreate(uuid())`; its type is the first word of `written`. */
export function removedPresetWrittenAs(written: string, codecId?: string): RemovedFieldPreset {
  const [type = written] = written.split(/[ (]/);
  return {
    type: type.split('.'),
    ...(codecId === undefined ? {} : { codecId }),
    rewrite: () => `Write ${written}.`,
  };
}

/**
 * A preset that took `onCreate: now` and `onUpdate: now`, and a precision first when `takesPrecision`. Its rewrite writes `type`, with the precision as its argument and `@onCreate(now())` and `@onUpdate(now())` for the phases the call set.
 */
export function removedPresetWithPhases(
  type: string,
  codecId: string,
  takesPrecision: boolean,
): RemovedFieldPreset {
  const parameters = takesPrecision ? ['precision', ...PHASES] : [...PHASES];
  const fallback = `Write ${type}${takesPrecision ? '(...)' : ''} with @onCreate(now()) and @onUpdate(now()) for the phases the preset set.`;
  return {
    type: [type],
    codecId,
    rewrite: (call) => {
      const args = argumentsByParameter(call.args, parameters);
      const precision = args?.get('precision');
      if (
        args === undefined ||
        (precision !== undefined && !/^\d+$/.test(precision)) ||
        PHASES.some((phase) => args.has(phase) && args.get(phase) !== 'now')
      ) {
        return fallback;
      }
      const attributes = PHASES.filter((phase) => args.has(phase)).map(
        (phase) => ` @${phase}(now())`,
      );
      return `Write ${type}${precision === undefined ? '' : `(${precision})`}${attributes.join('')}.`;
    },
  };
}

/**
 * The refusal of a call to a field preset Prisma 8 removed, naming what to write instead, or `undefined` when `presets` has no row for the call that applies to a stack whose types `types` holds.
 */
export function describeRemovedFieldPreset(
  presets: RemovedFieldPresets,
  call: ResolvedTypeConstructorCall,
  types: ContributedTypeNamespace,
): string | undefined {
  const path = call.path.join('.');
  const preset = Object.hasOwn(presets, path) ? presets[path] : undefined;
  if (preset === undefined) return undefined;
  const replacement = contributedTypeAt(types, preset.type);
  if (
    replacement === undefined ||
    (preset.codecId !== undefined && contributedTypeCodecId(replacement) !== preset.codecId)
  ) {
    return undefined;
  }
  return `${printTypeConstructorCall(call)} was a field preset, and Prisma 8 removed field presets. ${preset.rewrite(call)}`;
}
