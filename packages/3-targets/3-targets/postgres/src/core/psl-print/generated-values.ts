import type { ExecutionMutationDefault } from '@internal/contract/types';
import type { SqlPslBuildContext } from '@internal/family-sql/control';
import {
  defaultFunctionCallFor,
  type FieldPresetArgument,
  fieldPresetArguments,
  fieldPresetWriting,
} from '@internal/family-sql/psl-build';
import type { AuthoringFieldPresetLift } from '@internal/framework-components/authoring';
import type {
  PslAttributeArgument,
  PslFieldAttribute,
} from '@internal/framework-components/psl-ast';
import { buildAttribute, namedArg, positionalArg } from '../psl-build/psl-literals';
import {
  refuseGeneratorOnUpdate,
  refuseGeneratorWithoutPslFunction,
  refuseNowGeneratorPairedWithAnother,
} from './refusals';

/** The field preset a column's generators are written with, and the phases it must switch on. */
export interface PresetPhases {
  readonly path: readonly string[];
  readonly lift: AuthoringFieldPresetLift;
  readonly onCreate: boolean;
  readonly onUpdate: boolean;
}

export type BuiltExecutionDefault =
  | { readonly kind: 'attribute'; readonly attribute: PslFieldAttribute }
  | { readonly kind: 'preset'; readonly phases: PresetPhases };

/**
 * How one column's execution generators are written in PSL: as the field preset of the stack that writes the column's codec with them, or else an id generator as a `@default(<fn>())` attribute.
 */
export function buildExecutionDefault(input: {
  readonly executionDefault: ExecutionMutationDefault;
  readonly codecId: string;
  readonly coordinate: string;
  readonly context: SqlPslBuildContext;
}): BuiltExecutionDefault {
  const { executionDefault, codecId, coordinate, context } = input;
  const onCreateId = executionDefault.onCreate?.id;
  const onUpdateId = executionDefault.onUpdate?.id;

  for (const generatorId of new Set([onCreateId, onUpdateId])) {
    if (generatorId === undefined) continue;
    const preset = fieldPresetWriting(context.authoringContributions.field, codecId, generatorId);
    if (preset === undefined) continue;
    const onCreate = onCreateId !== undefined && preset.lift.onCreate?.generatorId === onCreateId;
    const onUpdate = onUpdateId !== undefined && preset.lift.onUpdate?.generatorId === onUpdateId;
    if ((onCreateId !== undefined && !onCreate) || (onUpdateId !== undefined && !onUpdate)) {
      refuseNowGeneratorPairedWithAnother({
        coordinate,
        onCreate: onCreateId,
        onUpdate: onUpdateId,
        other: onCreate ? onUpdateId : onCreateId,
      });
    }
    return { kind: 'preset', phases: { ...preset, onCreate, onUpdate } };
  }

  const phases = { coordinate, onCreate: onCreateId, onUpdate: onUpdateId };
  if (onUpdateId !== undefined) refuseGeneratorOnUpdate(phases);
  const call =
    onCreateId === undefined
      ? undefined
      : defaultFunctionCallFor(
          context.defaultFunctionCallsByGenerator,
          onCreateId,
          executionDefault.onCreate?.params,
        );
  if (call === undefined) refuseGeneratorWithoutPslFunction(phases);
  return {
    kind: 'attribute',
    attribute: buildAttribute('field', 'default', [positionalArg(call)]),
  };
}

function toPslArgument(argument: FieldPresetArgument): PslAttributeArgument {
  return argument.kind === 'positional'
    ? positionalArg(argument.value)
    : namedArg(argument.name, argument.value);
}

/** The argument list of the preset call a column's generators are written with. */
export function presetArguments(input: {
  readonly phases: PresetPhases;
  readonly typeParams: Readonly<Record<string, unknown>> | undefined;
}): readonly PslAttributeArgument[] {
  return fieldPresetArguments({
    lift: input.phases.lift,
    typeParams: input.typeParams,
    onCreate: input.phases.onCreate,
    onUpdate: input.phases.onUpdate,
  }).map(toPslArgument);
}
