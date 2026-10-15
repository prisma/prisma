import type { FieldPresetPrintForm } from '@internal/framework-components/authoring';
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

/**
 * The arguments of a preset's call: the column type params it writes positionally, up to the first one the column does not set, then for each phase the option argument value that selects the phase's generator.
 */
export function fieldPresetArguments(input: {
  readonly printForm: FieldPresetPrintForm;
  readonly typeParams: Readonly<Record<string, unknown>> | undefined;
  readonly onCreate: string | undefined;
  readonly onUpdate: string | undefined;
}): readonly FieldPresetArgument[] {
  const { printForm } = input;
  const positional: FieldPresetArgument[] = [];
  for (const name of printForm.typeParams) {
    const value = input.typeParams?.[name];
    if (value === undefined) break;
    positional.push({ kind: 'positional', value: JSON.stringify(value) });
  }
  const phases = (
    [
      [printForm.onCreate, input.onCreate],
      [printForm.onUpdate, input.onUpdate],
    ] as const
  ).flatMap(([phase, generatorId]): FieldPresetArgument[] => {
    const value = generatorId === undefined ? undefined : phase?.valuesByGenerator.get(generatorId);
    return phase === undefined || value === undefined
      ? []
      : [{ kind: 'named', name: phase.argument, value }];
  });
  return [...positional, ...phases];
}
