import { isInternalError } from '@internal/utils/internal-error';
import {
  type AuthoringTypeChoiceDescriptor,
  isAuthoringTypeChoiceOption,
  resolveAuthoringTypeChoice,
  typeConstructorLookup,
} from './authoring-type-choice';
import {
  type AuthoringTypeConstructorCall,
  type AuthoringTypeConstructorOutput,
  sameAuthoringTypeConstructorOutput,
} from './authoring-type-constructor-call';
import {
  type AuthoringTypeNamespace,
  type AuthoringTypeNamespaceMember,
  instantiateAuthoringTypeCall,
  instantiateAuthoringTypeConstructor,
  isAuthoringTypeChoiceDescriptor,
} from './framework-authoring';

/** One argument of a type choice call, written by name. */
export interface AuthoringTypeChoiceCallArgument {
  readonly name: string;
  readonly value: unknown;
}

/** A type choice, by its path in an authoring namespace, and the arguments of one call to it in the choice's argument order; an argument left out takes its default. */
export interface AuthoringTypeChoiceCall {
  readonly path: readonly string[];
  readonly args: readonly AuthoringTypeChoiceCallArgument[];
  /** The type constructor call the type choice call becomes. */
  readonly becomes: AuthoringTypeConstructorCall;
}

function namespaceLevel(
  namespace: AuthoringTypeNamespace,
  path: readonly string[],
): AuthoringTypeNamespace | undefined {
  let level: AuthoringTypeNamespace | undefined = namespace;
  for (const segment of path) {
    const member: AuthoringTypeNamespaceMember | undefined =
      level !== undefined && Object.hasOwn(level, segment) ? level[segment] : undefined;
    level = member !== undefined && !('kind' in member) ? member : undefined;
  }
  return level;
}

function firstChoiceNaming(
  level: AuthoringTypeNamespace,
  constructorName: string,
):
  | {
      readonly name: string;
      readonly descriptor: AuthoringTypeChoiceDescriptor;
      readonly when: Readonly<Record<string, string>>;
    }
  | undefined {
  for (const [name, member] of Object.entries(level)) {
    if (!isAuthoringTypeChoiceDescriptor(member)) continue;
    const row = member.choices.find((candidate) => candidate.type === constructorName);
    if (row !== undefined) return { name, descriptor: member, when: row.when };
  }
  return undefined;
}

function outputOf(produce: () => AuthoringTypeConstructorOutput) {
  try {
    return produce();
  } catch (error) {
    if (isInternalError(error)) throw error;
    return undefined;
  }
}

/**
 * The call to a type choice that becomes the type constructor call `call`: the first type choice, in namespace order at the constructor's level, with a row naming the constructor. Its options come from that row and its passed-on arguments from the call, and every argument whose omission still gives the same output is left out. `sameOutput` decides what counts as the same output; by default the codec and type parameters must be exactly equal. `undefined` when no type choice names the constructor or no call to it gives the same output.
 */
export function findAuthoringTypeChoiceCall(input: {
  readonly namespace: AuthoringTypeNamespace;
  readonly call: AuthoringTypeConstructorCall;
  readonly sameOutput?: (
    produced: AuthoringTypeConstructorOutput,
    wanted: AuthoringTypeConstructorOutput,
  ) => boolean;
}): AuthoringTypeChoiceCall | undefined {
  const { call } = input;
  const sameOutput = input.sameOutput ?? sameAuthoringTypeConstructorOutput;
  const prefix = call.path.slice(0, -1);
  const constructorName = call.path.at(-1);
  const level = namespaceLevel(input.namespace, prefix);
  if (level === undefined || constructorName === undefined) return undefined;
  const explicit = typeConstructorLookup(level)(constructorName);
  const choice = explicit && firstChoiceNaming(level, constructorName);
  const wanted =
    explicit && outputOf(() => instantiateAuthoringTypeConstructor(explicit, call.args));
  if (explicit === undefined || choice === undefined || wanted === undefined) return undefined;

  const passedValue = (name: string) =>
    call.args[(explicit.args ?? []).findIndex((parameter) => parameter.name === name)];
  const reproduces = (args: readonly unknown[]) => {
    const produced = outputOf(() => instantiateAuthoringTypeCall(level, choice.name, args));
    return produced !== undefined && sameOutput(produced, wanted);
  };

  const args: unknown[] = choice.descriptor.args.map((argument) =>
    isAuthoringTypeChoiceOption(argument) ? choice.when[argument.name] : passedValue(argument.name),
  );
  if (!reproduces(args)) return undefined;
  for (const index of args.keys()) {
    const without = args.map((value, at) => (at === index ? undefined : value));
    if (args[index] !== undefined && reproduces(without)) args[index] = undefined;
  }

  const chosen = resolveAuthoringTypeChoice({
    helperPath: choice.name,
    descriptor: choice.descriptor,
    args,
    constructorNamed: typeConstructorLookup(level),
  });
  const chosenArgs = [...chosen.args];
  while (chosenArgs.length > 0 && chosenArgs.at(-1) === undefined) chosenArgs.pop();
  return {
    path: [...prefix, choice.name],
    args: choice.descriptor.args.flatMap((argument, index) =>
      args[index] === undefined ? [] : [{ name: argument.name, value: args[index] }],
    ),
    becomes: { path: [...prefix, chosen.type], args: chosenArgs },
  };
}
