import type { ExecutionMutationDefault } from '@internal/contract/types';
import { isExecutionMutationDefaultValue } from '@internal/contract/types';
import type { SqlPslBuildContext } from '@internal/family-sql/control';
import {
  type AuthoringTemplateValue,
  isAuthoringFieldPresetDescriptor,
  isAuthoringSelectRef,
} from '@internal/framework-components/authoring';
import type { GeneratorCallWriter } from '@internal/framework-components/control';
import type {
  PslAttributeArgument,
  PslFieldAttribute,
} from '@internal/framework-components/psl-ast';
import { buildAttribute, namedArg, positionalArg } from '../psl-build/psl-literals';
import {
  refuseGeneratorOnUpdate,
  refuseGeneratorWithoutPslFunction,
  refuseNowGeneratorPairedWithAnother,
  refuseTemporalPresetChoice,
} from './refusals';

const TEMPORAL_NAMESPACE = 'temporal';

function generatorCallFor(
  context: SqlPslBuildContext,
  generatorId: string,
): GeneratorCallWriter | undefined {
  for (const entry of context.controlMutationDefaults.defaultFunctionRegistry.values()) {
    const call = entry.generatorCalls?.[generatorId];
    if (call !== undefined) return call;
  }
  return undefined;
}

function selectsNowGenerator(
  template: AuthoringTemplateValue | undefined,
  generatorId: string,
): boolean {
  if (!isAuthoringSelectRef(template)) return false;
  const now = template.cases['now'];
  return isExecutionMutationDefaultValue(now) && now.id === generatorId;
}

/**
 * The `temporal.*` presets that write `codecId` with `generatorId` chosen by `now` in each phase.
 * A preset whose phases are fixed, such as `temporal.updatedAt`, takes no `now` and is skipped.
 */
function temporalPresetsFor(
  context: SqlPslBuildContext,
  codecId: string,
  generatorId: string,
): readonly string[] {
  const temporal = context.authoringContributions.field[TEMPORAL_NAMESPACE];
  if (temporal === undefined || isAuthoringFieldPresetDescriptor(temporal)) return [];
  return Object.entries(temporal).flatMap(([name, member]) => {
    if (!isAuthoringFieldPresetDescriptor(member) || member.output.codecId !== codecId) return [];
    const phases = member.output.executionDefaults;
    return selectsNowGenerator(phases?.onCreate, generatorId) &&
      selectsNowGenerator(phases?.onUpdate, generatorId)
      ? [name]
      : [];
  });
}

function temporalPresetOf(input: {
  readonly context: SqlPslBuildContext;
  readonly codecId: string;
  readonly generatorId: string | undefined;
  readonly coordinate: string;
}): string | undefined {
  const { generatorId } = input;
  if (generatorId === undefined) return undefined;
  const presets = temporalPresetsFor(input.context, input.codecId, generatorId);
  if (presets.length > 1) {
    refuseTemporalPresetChoice({
      coordinate: input.coordinate,
      codecId: input.codecId,
      generatorId,
      presets: presets.map((preset) => `${TEMPORAL_NAMESPACE}.${preset}`),
    });
  }
  return presets[0];
}

/** The phases a column's `temporal.*` preset must switch on. */
export interface TemporalPresetPhases {
  readonly presetName: string;
  readonly onCreate: boolean;
  readonly onUpdate: boolean;
}

export type BuiltExecutionDefault =
  | { readonly kind: 'attribute'; readonly attribute: PslFieldAttribute }
  | { readonly kind: 'temporal'; readonly phases: TemporalPresetPhases };

/**
 * How one column's execution generators are written in PSL: an id generator as a `@default(<fn>())`
 * attribute, and a wall-clock-now generator as the `temporal.*` preset the column's codec is
 * authored through.
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

  for (const nowGeneratorId of new Set([onCreateId, onUpdateId])) {
    const presetName = temporalPresetOf({
      context,
      codecId,
      generatorId: nowGeneratorId,
      coordinate,
    });
    if (presetName === undefined) continue;
    const onCreate = onCreateId === nowGeneratorId;
    const onUpdate = onUpdateId === nowGeneratorId;
    if ((onCreateId !== undefined && !onCreate) || (onUpdateId !== undefined && !onUpdate)) {
      refuseNowGeneratorPairedWithAnother({
        coordinate,
        onCreate: onCreateId,
        onUpdate: onUpdateId,
        other: onCreate ? onUpdateId : onCreateId,
      });
    }
    return { kind: 'temporal', phases: { presetName, onCreate, onUpdate } };
  }

  const phases = { coordinate, onCreate: onCreateId, onUpdate: onUpdateId };
  if (onUpdateId !== undefined) refuseGeneratorOnUpdate(phases);
  const call = onCreateId === undefined ? undefined : generatorCallFor(context, onCreateId);
  if (call === undefined) refuseGeneratorWithoutPslFunction(phases);
  return {
    kind: 'attribute',
    attribute: buildAttribute('field', 'default', [
      positionalArg(call(executionDefault.onCreate?.params)),
    ]),
  };
}

/** The `temporal.<preset>(precision?, onCreate: now, onUpdate: now)` argument list. */
export function temporalPresetArguments(input: {
  readonly phases: TemporalPresetPhases;
  readonly precision: unknown;
}): readonly PslAttributeArgument[] {
  const args: PslAttributeArgument[] = [];
  if (typeof input.precision === 'number') {
    args.push(positionalArg(String(input.precision)));
  }
  if (input.phases.onCreate) {
    args.push(namedArg('onCreate', 'now'));
  }
  if (input.phases.onUpdate) {
    args.push(namedArg('onUpdate', 'now'));
  }
  return args;
}
