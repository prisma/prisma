import type { ExecutionMutationDefaultPhases } from '@internal/contract/types';
import {
  type FieldPresetPhasePrintForm,
  type FieldPresetPrintForm,
  instantiateAuthoringFieldPreset,
  type PrintableFieldPreset,
} from '@internal/framework-components/authoring';
import type { DefaultFunctionPrinter } from '@internal/framework-components/control';

/** The PSL call of the default function that produces `generatorId` with `params`, or `undefined` when no default function in the stack writes it. */
export function defaultFunctionCallFor(
  defaultFunctionPrintersByGenerator: ReadonlyMap<string, DefaultFunctionPrinter>,
  generatorId: string,
  params: Readonly<Record<string, unknown>> | undefined,
): string | undefined {
  const printer = defaultFunctionPrintersByGenerator.get(generatorId);
  return printer === undefined
    ? undefined
    : `${printer.functionName}(${printer.printArguments(params)})`;
}

export type FieldPresetArgument =
  | { readonly kind: 'positional'; readonly value: string }
  | { readonly kind: 'named'; readonly name: string; readonly value: string };

interface FieldPresetCallInput {
  readonly typeParams: Readonly<Record<string, unknown>> | undefined;
  readonly onCreate: string | undefined;
  readonly onUpdate: string | undefined;
}

interface FieldPresetCall {
  readonly positional: readonly unknown[];
  readonly phases: readonly { readonly phase: FieldPresetPhasePrintForm; readonly value: string }[];
}

function fieldPresetCall(
  printForm: FieldPresetPrintForm,
  input: FieldPresetCallInput,
): FieldPresetCall {
  const positional: unknown[] = [];
  for (const name of printForm.typeParams) {
    const value = input.typeParams?.[name];
    if (value === undefined) break;
    positional.push(value);
  }
  const phases = (
    [
      [printForm.onCreate, input.onCreate],
      [printForm.onUpdate, input.onUpdate],
    ] as const
  ).flatMap(([phase, generatorId]) => {
    const value = generatorId === undefined ? undefined : phase?.valuesByGenerator.get(generatorId);
    return phase === undefined || value === undefined ? [] : [{ phase, value }];
  });
  return { positional, phases };
}

/**
 * The arguments of a preset's call: the column type params it writes positionally, up to the first one the column does not set, then for each phase the option argument value that selects the phase's generator.
 */
export function fieldPresetArguments(
  input: FieldPresetCallInput & { readonly printForm: FieldPresetPrintForm },
): readonly FieldPresetArgument[] {
  const call = fieldPresetCall(input.printForm, input);
  return [
    ...call.positional.map(
      (value): FieldPresetArgument => ({ kind: 'positional', value: JSON.stringify(value) }),
    ),
    ...call.phases.map(
      ({ phase, value }): FieldPresetArgument => ({ kind: 'named', name: phase.argument, value }),
    ),
  ];
}

/** The generators the preset call `fieldPresetArguments` writes reads back with, params included. */
export function fieldPresetGenerators(
  input: FieldPresetCallInput & { readonly preset: PrintableFieldPreset },
): ExecutionMutationDefaultPhases {
  const call = fieldPresetCall(input.preset.printForm, input);
  const args = [...call.positional];
  for (const { phase, value } of call.phases) args[phase.index] = value;
  return instantiateAuthoringFieldPreset(input.preset.descriptor, args).executionDefaults ?? {};
}
