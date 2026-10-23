import type { TypeLookups } from '@internal/framework-components/codec';
import { codecTypeParamsProblem } from '@internal/mongo-contract/data-type';
import {
  type BuildRefusal,
  type BuildWarning,
  type FieldKey,
  modelFieldKey,
  valueObjectFieldKey,
} from './build-refusals';
import type { FieldNode, ModelNode, ValueObjectNode } from './contract-definition';

function generatesNothing(field: FieldNode): boolean {
  const contributed = field.presetContribution?.executionDefaults;
  const calls = field.generatorCalls;
  const values = field.generatedValues;
  return (
    values?.onCreate === undefined &&
    values?.onUpdate === undefined &&
    contributed?.onCreate === undefined &&
    contributed?.onUpdate === undefined &&
    calls?.onCreate === undefined &&
    calls?.onUpdate === undefined
  );
}

function checkField(
  field: FieldNode,
  key: FieldKey,
  input: {
    readonly declaredEnums: ReadonlySet<string>;
    readonly lookups: TypeLookups;
    readonly refusals: BuildRefusal[];
    readonly warnings: BuildWarning[];
  },
): void {
  const { type } = field;
  if (field.enumName !== undefined && !input.declaredEnums.has(field.enumName)) {
    input.refusals.push({ kind: 'enumUnknown', key, enumName: field.enumName });
  }
  if (type.kind === 'scalar' && type.typeParams !== undefined) {
    const problem = codecTypeParamsProblem(type.codecId, type.typeParams, input.lookups);
    if (problem !== undefined) input.refusals.push({ kind: 'typeParamsInvalid', key, problem });
  }
  if (field.presetContribution !== undefined && type.kind === 'scalar' && generatesNothing(field)) {
    input.warnings.push({
      kind: 'presetWithoutEffect',
      key,
      preset: field.presetContribution.preset,
      codecId: type.codecId,
    });
  }
}

/**
 * Checks each field of the models and value objects on its own: its enum is declared, its data type accepts its type parameters, and a preset that made it generates a value.
 */
export function checkFields(input: {
  readonly models: readonly ModelNode[];
  readonly valueObjects: readonly ValueObjectNode[] | undefined;
  readonly declaredEnums: ReadonlySet<string>;
  readonly lookups: TypeLookups;
  readonly refusals: BuildRefusal[];
  readonly warnings: BuildWarning[];
}): void {
  for (const model of input.models) {
    for (const field of model.fields) {
      checkField(field, modelFieldKey(model.modelName, field.fieldName), input);
    }
  }
  for (const valueObject of input.valueObjects ?? []) {
    for (const field of valueObject.fields) {
      checkField(field, valueObjectFieldKey(valueObject.name, field.fieldName), input);
    }
  }
}
