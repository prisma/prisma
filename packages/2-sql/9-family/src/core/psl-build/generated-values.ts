import {
  type AuthoringFieldNamespace,
  type AuthoringFieldPresetLift,
  isAuthoringFieldPresetDescriptor,
} from '@internal/framework-components/authoring';
import type { LiftedDefaultFunctionCall } from '@internal/framework-components/control';

/** The PSL call of the default function that produces `generatorId` with `params`, or `undefined` when no default function in the stack writes it. */
export function defaultFunctionCallFor(
  callsByGenerator: ReadonlyMap<string, LiftedDefaultFunctionCall>,
  generatorId: string,
  params: Readonly<Record<string, unknown>> | undefined,
): string | undefined {
  const call = callsByGenerator.get(generatorId);
  return call === undefined ? undefined : `${call.functionName}(${call.liftArguments(params)})`;
}

export interface LiftedFieldPreset {
  readonly path: readonly string[];
  readonly lift: AuthoringFieldPresetLift;
}

function liftedFieldPresets(
  namespace: AuthoringFieldNamespace,
  path: readonly string[] = [],
): LiftedFieldPreset[] {
  return Object.entries(namespace).flatMap(([name, member]) => {
    const memberPath = [...path, name];
    if (!isAuthoringFieldPresetDescriptor(member)) return liftedFieldPresets(member, memberPath);
    return member.lift === undefined ? [] : [{ path: memberPath, lift: member.lift }];
  });
}

/** The preset in `field` that writes `codecId` with `generatorId` in one of its phases. Stack assembly allows at most one. */
export function fieldPresetWriting(
  field: AuthoringFieldNamespace,
  codecId: string,
  generatorId: string,
): LiftedFieldPreset | undefined {
  return liftedFieldPresets(field).find(
    ({ lift }) =>
      lift.codecId === codecId &&
      (lift.onCreate?.generatorId === generatorId || lift.onUpdate?.generatorId === generatorId),
  );
}

export type FieldPresetArgument =
  | { readonly kind: 'positional'; readonly value: string }
  | { readonly kind: 'named'; readonly name: string; readonly value: string };

/**
 * The arguments of a lifted preset's call: the column type params it writes positionally, up to the first one the column does not set, then the phase arguments of the phases it switches on.
 */
export function fieldPresetArguments(input: {
  readonly lift: AuthoringFieldPresetLift;
  readonly typeParams: Readonly<Record<string, unknown>> | undefined;
  readonly onCreate: boolean;
  readonly onUpdate: boolean;
}): readonly FieldPresetArgument[] {
  const positional: FieldPresetArgument[] = [];
  for (const name of input.lift.typeParams) {
    const value = input.typeParams?.[name];
    if (value === undefined) break;
    positional.push({ kind: 'positional', value: JSON.stringify(value) });
  }
  const phases = [
    input.onCreate ? input.lift.onCreate : undefined,
    input.onUpdate ? input.lift.onUpdate : undefined,
  ].flatMap((phase): FieldPresetArgument[] =>
    phase === undefined ? [] : [{ kind: 'named', name: phase.argument, value: phase.value }],
  );
  return [...positional, ...phases];
}
