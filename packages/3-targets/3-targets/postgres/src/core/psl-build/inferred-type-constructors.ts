import {
  type AuthoringTypeConstructorCall,
  type AuthoringTypeConstructorDescriptor,
  type AuthoringTypeNamespace,
  instantiateAuthoringTypeConstructor,
  isAuthoringArgRef,
  isAuthoringTypeConstructorDescriptor,
} from '@internal/framework-components/authoring';
import type {
  CodecLookupWithDescriptors,
  DataTypeLookup,
} from '@internal/framework-components/codec';
import { canonicalizeJson } from '@internal/framework-components/utils';
import {
  dataTypeParams,
  isSqlDataType,
  type SqlDataType,
  type SqlTypeParams,
} from '@internal/sql-contract/data-type';
import { isInternalError } from '@internal/utils/internal-error';

/** The type constructor `contract infer` writes for a data type, with the data type it produces. */
export interface InferredTypeConstructor {
  readonly path: readonly string[];
  readonly descriptor: AuthoringTypeConstructorDescriptor;
  readonly dataType: SqlDataType;
}

/** The constructors marked `inferred` in a stack, keyed by the id of the data type each produces. */
export type InferredTypeConstructors = ReadonlyMap<string, InferredTypeConstructor>;

function* typeConstructors(
  namespace: AuthoringTypeNamespace,
  path: readonly string[] = [],
): Generator<{
  readonly path: readonly string[];
  readonly descriptor: AuthoringTypeConstructorDescriptor;
}> {
  for (const [name, value] of Object.entries(namespace)) {
    if (isAuthoringTypeConstructorDescriptor(value)) {
      yield { path: [...path, name], descriptor: value };
    } else {
      yield* typeConstructors(value, [...path, name]);
    }
  }
}

/** Every constructor of `authoringTypes` marked `inferred`, by the data type its codec represents. */
export function inferredTypeConstructors(input: {
  readonly authoringTypes: AuthoringTypeNamespace;
  readonly codecLookup: Pick<CodecLookupWithDescriptors, 'descriptorFor'>;
  readonly dataTypeLookup: DataTypeLookup;
}): InferredTypeConstructors {
  const found = new Map<string, InferredTypeConstructor>();
  for (const { path, descriptor } of typeConstructors(input.authoringTypes)) {
    if (descriptor.inferred !== true) continue;
    const dataTypeId = input.codecLookup.descriptorFor(descriptor.output.codecId)?.dataType;
    const dataType = dataTypeId === undefined ? undefined : input.dataTypeLookup.get(dataTypeId);
    if (dataType === undefined || !isSqlDataType(dataType)) continue;
    found.set(dataType.id, { path, descriptor, dataType });
  }
  return found;
}

/** The data type parameter each positional argument maps onto, in argument order. */
function argumentKeys(
  descriptor: AuthoringTypeConstructorDescriptor,
): readonly string[] | undefined {
  const keys: (string | undefined)[] = (descriptor.args ?? []).map(() => undefined);
  for (const [key, template] of Object.entries(descriptor.output.typeParams ?? {})) {
    if (!isAuthoringArgRef(template) || template.path !== undefined) return undefined;
    if (template.index >= keys.length) return undefined;
    keys[template.index] = key;
  }
  return keys.every((key) => key !== undefined) ? keys : undefined;
}

function normalParams(
  marked: InferredTypeConstructor,
  args: readonly unknown[],
): string | undefined {
  try {
    const { typeParams } = instantiateAuthoringTypeConstructor(marked.descriptor, args);
    const params = dataTypeParams(marked.dataType, typeParams);
    return canonicalizeJson(marked.dataType.sql.normalize(params));
  } catch (error) {
    if (isInternalError(error)) throw error;
    return undefined;
  }
}

/**
 * The call to `constructor` with the fewest arguments that produces `params`, the normal form of a
 * column's data type parameters: arguments are dropped from the end while the normal form of what
 * the call produces stays `params`. Undefined when the constructor cannot produce them, such as one
 * whose argument names another entity.
 */
export function fewestArgumentsCall(
  marked: InferredTypeConstructor,
  params: SqlTypeParams,
): AuthoringTypeConstructorCall | undefined {
  const { descriptor } = marked;
  if (descriptor.entityRefArg !== undefined) return undefined;
  const keys = argumentKeys(descriptor);
  if (keys === undefined) return undefined;
  const wanted = canonicalizeJson(params);
  const args = keys.map((key) => params[key]);
  while (args.length > 0 && args[args.length - 1] === undefined) args.pop();
  if (args.includes(undefined)) return undefined;
  if (normalParams(marked, args) !== wanted) return undefined;
  while (args.length > 0 && normalParams(marked, args.slice(0, -1)) === wanted) args.pop();
  return { path: marked.path, args };
}
