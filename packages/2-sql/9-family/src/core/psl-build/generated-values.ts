import type {
  ExecutionMutationDefaultPhases,
  ExecutionMutationDefaultValue,
} from '@internal/contract/types';
import {
  type FieldPresetPrintForm,
  type FieldPresetsByCodecAndGenerator,
  instantiateAuthoringFieldPreset,
  type PrintableFieldPreset,
} from '@internal/framework-components/authoring';
import type { DefaultFunctionPrinter } from '@internal/framework-components/control';
import { canonicalizeJson } from '@internal/framework-components/utils';

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

type ColumnPhase = 'onCreate' | 'onUpdate';

/** A part of the column the preset call reads back differently, or a required argument the call cannot write. */
export type FieldPresetReadBackDifference =
  | { readonly part: 'typeRef'; readonly column: string; readonly printed: undefined }
  | { readonly part: 'codecId'; readonly column: string; readonly printed: string }
  | {
      readonly part: 'typeParams';
      readonly column: Readonly<Record<string, unknown>> | undefined;
      readonly printed: Readonly<Record<string, unknown>> | undefined;
    }
  | {
      readonly part: ColumnPhase;
      readonly column: ExecutionMutationDefaultValue | undefined;
      readonly printed: ExecutionMutationDefaultValue | undefined;
    }
  | { readonly part: 'argument'; readonly name: string };

/** How a column's generators are written with a field preset, or why they cannot be. */
export type FieldPresetCallChoice =
  | { readonly kind: 'noPreset' }
  | {
      readonly kind: 'call';
      readonly preset: PrintableFieldPreset;
      readonly arguments: readonly FieldPresetArgument[];
    }
  | { readonly kind: 'phasesNotWrittenTogether'; readonly preset: PrintableFieldPreset }
  | {
      readonly kind: 'readsBackDifferently';
      readonly preset: PrintableFieldPreset;
      readonly differences: readonly FieldPresetReadBackDifference[];
    };

interface FieldPresetColumn {
  readonly codecId: string;
  readonly typeRef: string | undefined;
  readonly typeParams: Readonly<Record<string, unknown>> | undefined;
  readonly generators: ExecutionMutationDefaultPhases;
}

const PHASES: readonly ColumnPhase[] = ['onCreate', 'onUpdate'];

function sameParams(
  left: Readonly<Record<string, unknown>> | undefined,
  right: Readonly<Record<string, unknown>> | undefined,
): boolean {
  return canonicalizeJson(left ?? {}) === canonicalizeJson(right ?? {});
}

function sameGenerator(
  left: ExecutionMutationDefaultValue | undefined,
  right: ExecutionMutationDefaultValue | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right;
  return left.id === right.id && sameParams(left.params, right.params);
}

function writesEveryPhase(printForm: FieldPresetPrintForm, column: FieldPresetColumn): boolean {
  return PHASES.every((phase) => {
    const generatorId = column.generators[phase]?.id;
    return generatorId === undefined || printForm[phase]?.valuesByGenerator.has(generatorId);
  });
}

interface WrittenArgument {
  readonly index: number;
  readonly value: unknown;
  readonly argument: FieldPresetArgument;
}

function writtenArguments(
  printForm: FieldPresetPrintForm,
  column: FieldPresetColumn,
): readonly WrittenArgument[] {
  const positional: WrittenArgument[] = [];
  for (const [index, name] of printForm.typeParams.entries()) {
    const value = column.typeParams?.[name];
    if (value === undefined) break;
    positional.push({
      index,
      value,
      argument: { kind: 'positional', value: JSON.stringify(value) },
    });
  }
  const named = PHASES.flatMap((phase): WrittenArgument[] => {
    const phasePrintForm = printForm[phase];
    const generatorId = column.generators[phase]?.id;
    const value =
      generatorId === undefined ? undefined : phasePrintForm?.valuesByGenerator.get(generatorId);
    if (phasePrintForm === undefined || value === undefined) return [];
    const { argument: name, index } = phasePrintForm;
    return [{ index, value, argument: { kind: 'named', name, value } }];
  });
  return [...positional, ...named];
}

function readBackDifferences(
  preset: PrintableFieldPreset,
  column: FieldPresetColumn,
  args: readonly unknown[],
): readonly FieldPresetReadBackDifference[] {
  const namedType =
    column.typeRef === undefined
      ? []
      : [{ part: 'typeRef' as const, column: column.typeRef, printed: undefined }];
  const missing = (preset.descriptor.args ?? []).flatMap((argument, index) =>
    argument.optional === true || args[index] !== undefined
      ? []
      : [{ part: 'argument' as const, name: argument.name ?? String(index) }],
  );
  if (missing.length > 0) return [...namedType, ...missing];
  const printed = instantiateAuthoringFieldPreset(preset.descriptor, args);
  const printedGenerators = printed.executionDefaults ?? {};
  return [
    ...namedType,
    ...(printed.descriptor.codecId === column.codecId
      ? []
      : [
          {
            part: 'codecId' as const,
            column: column.codecId,
            printed: printed.descriptor.codecId,
          },
        ]),
    ...(sameParams(column.typeParams, printed.descriptor.typeParams)
      ? []
      : [
          {
            part: 'typeParams' as const,
            column: column.typeParams,
            printed: printed.descriptor.typeParams,
          },
        ]),
    ...PHASES.flatMap((phase) =>
      sameGenerator(column.generators[phase], printedGenerators[phase])
        ? []
        : [{ part: phase, column: column.generators[phase], printed: printedGenerators[phase] }],
    ),
  ];
}

/**
 * The call of the field preset in the stack that writes a column's codec with its generators, checked to read back as the same column: no named type, since a preset call writes none, and the same codec, type params and generators with their params, where absent and empty params count as the same. Otherwise the reason it cannot be written that way.
 */
export function fieldPresetCallFor(input: {
  readonly fieldPresetsByCodecAndGenerator: FieldPresetsByCodecAndGenerator;
  readonly column: FieldPresetColumn;
}): FieldPresetCallChoice {
  const { column } = input;
  const byGenerator = input.fieldPresetsByCodecAndGenerator.get(column.codecId);
  const preset = PHASES.map((phase) => column.generators[phase]?.id)
    .map((generatorId) => (generatorId === undefined ? undefined : byGenerator?.get(generatorId)))
    .find((found) => found !== undefined);
  if (preset === undefined) return { kind: 'noPreset' };
  if (!writesEveryPhase(preset.printForm, column)) {
    return { kind: 'phasesNotWrittenTogether', preset };
  }
  const written = writtenArguments(preset.printForm, column);
  const args: unknown[] = [];
  for (const { index, value } of written) args[index] = value;
  const differences = readBackDifferences(preset, column, args);
  if (differences.length > 0) return { kind: 'readsBackDifferently', preset, differences };
  return {
    kind: 'call',
    preset,
    arguments: written.map(({ argument }) => argument),
  };
}
