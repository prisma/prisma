import type { ExecutionMutationDefault } from '@internal/contract/types';
import type { SqlPslBuildContext } from '@internal/family-sql/control';
import {
  defaultFunctionCallFor,
  type FieldPresetArgument,
  fieldPresetCallFor,
} from '@internal/family-sql/psl-build';
import type {
  PslAttributeArgument,
  PslFieldAttribute,
} from '@internal/framework-components/psl-ast';
import { buildAttribute, namedArg, positionalArg } from '../psl-build/psl-literals';
import {
  refuseGeneratorOnUpdate,
  refuseGeneratorsNoPresetWritesTogether,
  refuseGeneratorWithoutPslFunction,
  refusePresetCallReadingBackDifferently,
} from './refusals';

export type BuiltExecutionDefault =
  | { readonly kind: 'attribute'; readonly attribute: PslFieldAttribute }
  | {
      readonly kind: 'preset';
      readonly path: readonly string[];
      readonly args: readonly PslAttributeArgument[];
    };

function toPslArgument(argument: FieldPresetArgument): PslAttributeArgument {
  return argument.kind === 'positional'
    ? positionalArg(argument.value)
    : namedArg(argument.name, argument.value);
}

/**
 * How one column's execution generators are written in PSL: as the field preset of the stack that writes the column's codec with them, or else an id generator as a `@default(<fn>())` attribute.
 */
export function buildExecutionDefault(input: {
  readonly executionDefault: ExecutionMutationDefault;
  readonly codecId: string;
  readonly typeParams: Readonly<Record<string, unknown>> | undefined;
  readonly coordinate: string;
  readonly context: SqlPslBuildContext;
}): BuiltExecutionDefault {
  const { executionDefault, codecId, typeParams, coordinate, context } = input;
  const onCreateId = executionDefault.onCreate?.id;
  const onUpdateId = executionDefault.onUpdate?.id;
  const phases = { coordinate, onCreate: onCreateId, onUpdate: onUpdateId };

  const choice = fieldPresetCallFor({
    fieldPresetsByCodecAndGenerator: context.fieldPresetsByCodecAndGenerator,
    column: { codecId, typeParams, generators: executionDefault },
  });
  switch (choice.kind) {
    case 'call':
      return {
        kind: 'preset',
        path: choice.preset.path,
        args: choice.arguments.map(toPslArgument),
      };
    case 'phasesNotWrittenTogether':
      return refuseGeneratorsNoPresetWritesTogether(phases);
    case 'readsBackDifferently':
      return refusePresetCallReadingBackDifferently({
        coordinate,
        preset: choice.preset.path.join('.'),
        differences: choice.differences,
      });
    case 'noPreset':
      break;
  }

  if (onUpdateId !== undefined) refuseGeneratorOnUpdate(phases);
  const call =
    onCreateId === undefined
      ? undefined
      : defaultFunctionCallFor(
          context.defaultFunctionPrintersByGenerator,
          onCreateId,
          executionDefault.onCreate?.params,
        );
  if (call === undefined) {
    refuseGeneratorWithoutPslFunction({
      ...phases,
      registeredBy:
        onCreateId !== undefined && context.componentIdsByGenerator.has(onCreateId)
          ? { componentId: context.componentIdsByGenerator.get(onCreateId) }
          : undefined,
    });
  }
  return {
    kind: 'attribute',
    attribute: buildAttribute('field', 'default', [positionalArg(call)]),
  };
}
