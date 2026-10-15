import type { ExecutionMutationDefault } from '@internal/contract/types';
import type { SqlPslBuildContext } from '@internal/family-sql/control';
import {
  defaultFunctionCallFor,
  type FieldPresetArgument,
  fieldPresetArguments,
} from '@internal/family-sql/psl-build';
import type {
  FieldPresetPhasePrintForm,
  PrintableFieldPreset,
} from '@internal/framework-components/authoring';
import type {
  PslAttributeArgument,
  PslFieldAttribute,
} from '@internal/framework-components/psl-ast';
import { buildAttribute, namedArg, positionalArg } from '../psl-build/psl-literals';
import {
  refuseGeneratorOnUpdate,
  refuseGeneratorsNoPresetWritesTogether,
  refuseGeneratorWithoutPslFunction,
} from './refusals';

/** The field preset a column's generators are written with, and the generator of each phase. */
export interface PresetPhases {
  readonly preset: PrintableFieldPreset;
  readonly onCreate: string | undefined;
  readonly onUpdate: string | undefined;
}

export type BuiltExecutionDefault =
  | { readonly kind: 'attribute'; readonly attribute: PslFieldAttribute }
  | { readonly kind: 'preset'; readonly phases: PresetPhases };

function writesPhase(
  phase: FieldPresetPhasePrintForm | undefined,
  generatorId: string | undefined,
): boolean {
  return generatorId === undefined || phase?.valuesByGenerator.has(generatorId) === true;
}

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
    const preset = context.fieldPresetsByCodecAndGenerator.get(codecId)?.get(generatorId);
    if (preset === undefined) continue;
    const { printForm } = preset;
    if (
      !writesPhase(printForm.onCreate, onCreateId) ||
      !writesPhase(printForm.onUpdate, onUpdateId)
    ) {
      refuseGeneratorsNoPresetWritesTogether({
        coordinate,
        onCreate: onCreateId,
        onUpdate: onUpdateId,
      });
    }
    return { kind: 'preset', phases: { preset, onCreate: onCreateId, onUpdate: onUpdateId } };
  }

  const phases = { coordinate, onCreate: onCreateId, onUpdate: onUpdateId };
  if (onUpdateId !== undefined) refuseGeneratorOnUpdate(phases);
  const call =
    onCreateId === undefined
      ? undefined
      : defaultFunctionCallFor(
          context.defaultFunctionPrintersByGenerator,
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
    printForm: input.phases.preset.printForm,
    typeParams: input.typeParams,
    onCreate: input.phases.onCreate,
    onUpdate: input.phases.onUpdate,
  }).map(toPslArgument);
}
