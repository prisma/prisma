import type {
  ExecutionMutationDefault,
  ExecutionMutationDefaultPhases,
  ExecutionMutationDefaultValue,
} from '@internal/contract/types';
import type { GeneratorFunctionRegistry } from '@internal/framework-components/components';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { canonicalStringify } from '@internal/utils/canonical-stringify';
import { storedNameOf } from './build-models';
import type { FieldNode, ModelNode, ValueObjectNode } from './contract-definition';
import { contractError } from './contract-errors';

function executionDefaultError(
  modelName: string,
  fieldName: string,
  reason: string,
  message: string,
): Error {
  return contractError('CONTRACT.DEFAULT_INVALID', `Field "${modelName}.${fieldName}" ${message}`, {
    meta: { modelName, fieldName, reason },
  });
}

function hasExecutionDefaults(field: FieldNode): boolean {
  const phases = field.executionDefaults;
  const calls = field.generatorCalls;
  return (
    phases?.onCreate !== undefined ||
    phases?.onUpdate !== undefined ||
    calls?.onCreate !== undefined ||
    calls?.onUpdate !== undefined
  );
}

/**
 * The phases a field generates: its resolved execution defaults, with the generators its calls resolve to for its codec.
 */
function executionDefaultsOf(
  field: FieldNode,
  modelName: string,
  generatorFunctions: GeneratorFunctionRegistry,
): ExecutionMutationDefaultPhases | undefined {
  const { fieldName } = field;
  const calls = field.generatorCalls;
  if (calls === undefined) return field.executionDefaults;
  const type = field.type;
  const codecId = type.kind === 'scalar' ? type.codecId : undefined;
  const phases: {
    onCreate?: ExecutionMutationDefaultValue;
    onUpdate?: ExecutionMutationDefaultValue;
  } = {
    ...field.executionDefaults,
  };
  for (const phase of ['onCreate', 'onUpdate'] as const) {
    const call = calls[phase];
    if (call === undefined) continue;
    const resolution =
      type.kind === 'scalar'
        ? generatorFunctions.resolve(call, {
            codecId: type.codecId,
            typeParams: type.typeParams,
            length: undefined,
          })
        : undefined;
    if (resolution?.ok === true) {
      phases[phase] = resolution.generator;
      continue;
    }
    const meta = { modelName, fieldName, codecId, function: call.name };
    if (resolution?.reason === 'unknown-function') {
      throw contractError(
        'CONTRACT.DEFAULT_INVALID',
        `Field "${modelName}.${fieldName}": no pack in the contract declares the generator function "${call.name}".`,
        { meta: { ...meta, reason: 'generator-unknown' } },
      );
    }
    throw contractError(
      'CONTRACT.DEFAULT_INVALID',
      resolution?.reason === 'refused'
        ? `Field "${modelName}.${fieldName}": ${resolution.message}`
        : `Field "${modelName}.${fieldName}": ${call.name}() does not apply to ${codecId === undefined ? "the field's type" : `codec "${codecId}"`}.`,
      { meta: { ...meta, reason: 'generator-not-applicable' } },
    );
  }
  return phases;
}

export function assertNoValueObjectExecutionDefaults(
  valueObjects: readonly ValueObjectNode[] | undefined,
): void {
  for (const valueObject of valueObjects ?? []) {
    for (const field of valueObject.fields) {
      if (hasExecutionDefaults(field)) {
        throw executionDefaultError(
          valueObject.name,
          field.fieldName,
          'executionDefaults-on-value-object',
          'has executionDefaults, but it belongs to a value object. Generated values are only supported on model fields.',
        );
      }
    }
  }
}

export function buildExecutionDefaults(
  models: readonly ModelNode[],
  generatorFunctions: GeneratorFunctionRegistry,
): ExecutionMutationDefault[] {
  const collectionByModelName = new Map(models.map((model) => [model.modelName, model.collection]));
  const byRef = new Map<
    string,
    { readonly modelName: string; readonly fieldName: string; readonly phasesKey: string }
  >();
  const defaults: ExecutionMutationDefault[] = [];
  for (const model of models) {
    const { modelName } = model;
    for (const field of model.fields) {
      if (!hasExecutionDefaults(field)) continue;
      const { fieldName } = field;
      const phases = executionDefaultsOf(field, modelName, generatorFunctions);
      if (phases === undefined) continue;
      if (field.nullable) {
        throw executionDefaultError(
          modelName,
          fieldName,
          'nullable-with-executionDefaults',
          'generates a value on write, so it cannot be optional; remove .optional().',
        );
      }
      if (field.many) {
        throw executionDefaultError(
          modelName,
          fieldName,
          'many-with-executionDefaults',
          'generates a value on write, so it cannot be a list; remove .many().',
        );
      }
      if (model.base !== undefined) {
        const collection = model.collection ?? collectionByModelName.get(model.base.model);
        throw executionDefaultError(
          modelName,
          fieldName,
          'executionDefaults-on-variant',
          `has executionDefaults, but "${modelName}" is a variant of "${model.base.model}". Execution defaults apply to every document in collection "${collection}", so declare them on the base model.`,
        );
      }
      const entry = model.collection;
      if (entry === undefined) {
        throw executionDefaultError(
          modelName,
          fieldName,
          'executionDefaults-without-collection',
          'has executionDefaults, but its model has no collection. Generated values are only supported on fields of a model stored in a collection.',
        );
      }
      const storedName = storedNameOf(field);
      const refKey = JSON.stringify([entry, storedName]);
      const phasesKey = canonicalStringify(phases);
      const existing = byRef.get(refKey);
      if (existing !== undefined) {
        if (existing.phasesKey !== phasesKey) {
          throw executionDefaultError(
            modelName,
            fieldName,
            'executionDefaults-conflict',
            `has different executionDefaults than "${existing.modelName}.${existing.fieldName}", which is stored in the same collection "${entry}". Use the same executionDefaults on both models.`,
          );
        }
        continue;
      }
      byRef.set(refKey, { modelName, fieldName, phasesKey });
      defaults.push({
        ref: { namespace: UNBOUND_NAMESPACE_ID, entry, field: storedName },
        ...phases,
      });
    }
  }
  return defaults;
}
