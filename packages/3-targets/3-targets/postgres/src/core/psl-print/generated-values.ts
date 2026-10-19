import type {
  ExecutionMutationDefault,
  ExecutionMutationDefaultValue,
} from '@internal/contract/types';
import type { SqlPslBuildContext } from '@internal/family-sql/control';
import type { PslFieldAttribute } from '@internal/framework-components/psl-ast';
import { canonicalizeJson } from '@internal/framework-components/utils';
import { buildAttribute, positionalArg } from '../psl-build/psl-literals';
import {
  refuseGeneratorOnList,
  refuseGeneratorReadingBackDifferently,
  refuseGeneratorWithoutPslFunction,
} from './refusals';

const GENERATOR_PHASES = ['onCreate', 'onUpdate'] as const;

/**
 * The `@onCreate(fn(...))` and `@onUpdate(fn(...))` attributes that write one column's generators, each the call of the generator function the stack binds to the column's codec. The written call must resolve back to the stored generator; a column whose generator no function writes, or whose call reads back differently, is refused.
 */
export function buildGeneratorAttributes(input: {
  readonly executionDefault: ExecutionMutationDefault;
  readonly codecId: string;
  readonly list: boolean;
  readonly typeParams: Readonly<Record<string, unknown>> | undefined;
  readonly coordinate: string;
  readonly context: SqlPslBuildContext;
}): readonly PslFieldAttribute[] {
  const { executionDefault, codecId, list, typeParams, coordinate, context } = input;
  const column = { codecId, typeParams };
  const attributes: PslFieldAttribute[] = [];
  for (const phase of GENERATOR_PHASES) {
    const generator: ExecutionMutationDefaultValue | undefined = executionDefault[phase];
    if (generator === undefined) continue;
    if (list) refuseGeneratorOnList({ coordinate, phase, generatorId: generator.id });
    const call = context.generatorFunctions.callFor(generator, column);
    if (call === undefined) {
      refuseGeneratorWithoutPslFunction({
        coordinate,
        phase,
        generatorId: generator.id,
        codecId,
        registeredBy: context.componentIdsByGenerator.has(generator.id)
          ? { componentId: context.componentIdsByGenerator.get(generator.id) }
          : undefined,
      });
    }
    const written = `${call.name}(${call.text})`;
    const readBack = context.generatorFunctions.resolve({
      name: call.name,
      args: call.args,
      column,
    });
    if (!readBack.ok || canonicalizeJson(readBack.generator) !== canonicalizeJson(generator)) {
      refuseGeneratorReadingBackDifferently({
        coordinate,
        phase,
        call: written,
        stored: generator,
        readBack: readBack.ok ? readBack.generator : undefined,
      });
    }
    attributes.push(buildAttribute('field', phase, [positionalArg(written)]));
  }
  return attributes;
}
