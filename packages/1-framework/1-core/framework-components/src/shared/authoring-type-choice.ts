import type { JsonValue } from '@internal/contract/types';
import type {
  AuthoringTypeConstructorDescriptor,
  AuthoringValueArgument,
} from './framework-authoring';
import type { AuthoringOption } from './option-descriptor';
import { runtimeError } from './runtime-error';

/** An argument of a type choice that picks its row: one of `values`, written as a bare name, and `default` when it is left out. */
export interface AuthoringTypeChoiceOption extends AuthoringOption {
  readonly name: string;
  readonly default: string;
  readonly optional: true;
}

/** An argument a type choice passes on, by name, to the constructor its row names. */
export type AuthoringTypeChoicePassedArgument = AuthoringValueArgument & {
  readonly name: string;
  readonly optional: true;
};

export type AuthoringTypeChoiceArgument =
  | AuthoringTypeChoiceOption
  | AuthoringTypeChoicePassedArgument;

/** One allowed combination of option values, the type constructor it chooses, and the values of passed-on arguments when they are left out. */
export interface AuthoringTypeChoiceRow {
  readonly when: Readonly<Record<string, string>>;
  /** A type constructor in the same namespace as the type choice. */
  readonly type: string;
  readonly defaults?: Readonly<Record<string, JsonValue>>;
}

/**
 * A type whose arguments choose the type constructor it becomes. Every argument is optional, so it is also written bare. A combination of option values with no row is refused. ADR 279.
 */
export interface AuthoringTypeChoiceDescriptor {
  readonly kind: 'typeChoice';
  readonly documentation?: string;
  readonly args: readonly AuthoringTypeChoiceArgument[];
  readonly choices: readonly AuthoringTypeChoiceRow[];
}

/** The constructor a type choice call chooses, by its name, and the arguments it is called with. */
export interface ResolvedAuthoringTypeChoice {
  readonly type: string;
  readonly descriptor: AuthoringTypeConstructorDescriptor;
  readonly args: readonly unknown[];
}

export function isAuthoringTypeChoiceOption(
  argument: AuthoringTypeChoiceArgument,
): argument is AuthoringTypeChoiceOption {
  return argument.kind === 'option';
}

function rowMatches(
  row: AuthoringTypeChoiceRow,
  chosen: ReadonlyMap<string, string>,
  names: readonly string[],
): boolean {
  return names.every((name) => row.when[name] === chosen.get(name));
}

/** How a combination of option values is written, as in `as: string, storage: timestamp`. */
export function typeChoiceCombinationText(row: AuthoringTypeChoiceRow): string {
  return Object.entries(row.when)
    .map(([name, value]) => `${name}: ${value}`)
    .join(', ');
}

function listedNames(names: readonly string[]): string {
  return names.length < 2
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function isArgumentObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Why `subject`, a call of the type choice `descriptor`, cannot take the argument `name`, naming the arguments it takes. */
export function unknownTypeChoiceArgumentMessage(
  subject: string,
  descriptor: AuthoringTypeChoiceDescriptor,
  name: string,
): string {
  const names = descriptor.args.map((argument) => argument.name);
  return `${subject} has no argument "${name}"; its arguments are ${listedNames(names)}.`;
}

/**
 * The values of a type choice call that writes its arguments as one object, by the choice's argument positions, as {@link resolveAuthoringTypeChoice} reads them. `written` is the call's arguments: none, or one object keyed by argument name. Anything else, and a key the choice has no argument for, is refused with `CONTRACT.ARGUMENT_INVALID`.
 */
export function typeChoiceArgumentsFromObject(
  helperPath: string,
  descriptor: AuthoringTypeChoiceDescriptor,
  written: readonly unknown[],
): readonly unknown[] {
  const names = descriptor.args.map((argument) => argument.name);
  const [first] = written;
  const object = written.length === 0 ? {} : first;
  if (written.length > 1 || !isArgumentObject(object)) {
    const example = descriptor.args.find(isAuthoringTypeChoiceOption);
    const sample = example === undefined ? '' : `{ ${example.name}: '${example.default}' }`;
    throw runtimeError(
      'CONTRACT.ARGUMENT_INVALID',
      `${helperPath} takes its arguments as one object with the keys ${listedNames(names)}, such as ${helperPath}(${sample}).`,
      { helperPath },
    );
  }
  const unknown = Object.keys(object).find((key) => !names.includes(key));
  if (unknown !== undefined) {
    throw runtimeError(
      'CONTRACT.ARGUMENT_INVALID',
      unknownTypeChoiceArgumentMessage(helperPath, descriptor, unknown),
      { helperPath },
    );
  }
  return names.map((name) => object[name]);
}

/**
 * The type constructor a call of the type choice `descriptor` chooses, and the arguments it passes on. `args` are the call's values by the choice's argument positions; an option left out takes its default. A value an option does not list, a combination with no row, and a passed-on argument the chosen constructor does not take are refused with `CONTRACT.ARGUMENT_INVALID`, naming the argument by its index.
 */
export function resolveAuthoringTypeChoice(input: {
  readonly helperPath: string;
  readonly descriptor: AuthoringTypeChoiceDescriptor;
  readonly args: readonly unknown[];
  readonly constructorNamed: (name: string) => AuthoringTypeConstructorDescriptor | undefined;
}): ResolvedAuthoringTypeChoice {
  const { helperPath, descriptor, args } = input;
  const refuse = (argumentIndex: number, message: string): never => {
    throw runtimeError('CONTRACT.ARGUMENT_INVALID', message, { helperPath, argumentIndex });
  };
  const label = (index: number) => `Argument "${descriptor.args[index]?.name}" of ${helperPath}`;

  const options = descriptor.args.flatMap((argument, index) =>
    isAuthoringTypeChoiceOption(argument) ? [{ argument, index }] : [],
  );
  const written = options.filter(({ index }) => args[index] !== undefined);
  const defaulted = options.filter(({ index }) => args[index] === undefined);

  const chosen = new Map<string, string>();
  const decided: string[] = [];
  for (const { argument, index } of [...written, ...defaulted]) {
    const value = args[index] ?? argument.default;
    if (typeof value !== 'string' || !argument.values.includes(value)) {
      refuse(
        index,
        `${label(index)} is ${String(value)}; write one of: ${argument.values.join(', ')}.`,
      );
    }
    const fitting = descriptor.choices.filter((row) => rowMatches(row, chosen, decided));
    const accepted = argument.values.filter((candidate) =>
      fitting.some((row) => row.when[argument.name] === candidate),
    );
    if (!accepted.includes(String(value))) {
      const others = decided.map((name) => `${name}: ${chosen.get(name)}`).join(', ');
      refuse(
        index,
        `${label(index)} cannot be ${String(value)} with ${others}; write one of: ${accepted.join(', ')}.`,
      );
    }
    chosen.set(argument.name, String(value));
    decided.push(argument.name);
  }

  const row = descriptor.choices.find((candidate) => rowMatches(candidate, chosen, decided));
  const chosenType = row === undefined ? undefined : input.constructorNamed(row.type);
  if (row === undefined || chosenType === undefined) {
    throw runtimeError(
      'CONTRACT.PACK_CONTRIBUTION_INVALID',
      `Type choice "${helperPath}" chooses no registered type constructor for ${[...chosen].map(([name, value]) => `${name}: ${value}`).join(', ')}.`,
      { helperPath },
    );
  }

  const parameters = chosenType.args ?? [];
  descriptor.args.forEach((argument, index) => {
    if (isAuthoringTypeChoiceOption(argument) || args[index] === undefined) return;
    if (!parameters.some((parameter) => parameter.name === argument.name)) {
      refuse(
        index,
        `${label(index)} does not apply to ${row.type}, the type that ${typeChoiceCombinationText(row)} chooses.`,
      );
    }
  });

  return {
    type: row.type,
    descriptor: chosenType,
    args: parameters.map((parameter) => {
      const index = descriptor.args.findIndex(
        (argument) => !isAuthoringTypeChoiceOption(argument) && argument.name === parameter.name,
      );
      const passed = index < 0 ? undefined : args[index];
      return passed ?? (parameter.name === undefined ? undefined : row.defaults?.[parameter.name]);
    }),
  };
}

type TypeNamespaceLevel = { readonly [name: string]: unknown };

/** Looks a type constructor up by name in one level of a type namespace, as a type choice's rows name them. */
export function typeConstructorLookup(
  namespace: TypeNamespaceLevel,
): (name: string) => AuthoringTypeConstructorDescriptor | undefined {
  return (name) => {
    const member = Object.hasOwn(namespace, name) ? namespace[name] : undefined;
    return isTypeConstructor(member) ? member : undefined;
  };
}

function isTypeChoice(value: unknown): value is AuthoringTypeChoiceDescriptor {
  return (
    typeof value === 'object' && value !== null && 'kind' in value && value.kind === 'typeChoice'
  );
}

function isTypeConstructor(value: unknown): value is AuthoringTypeConstructorDescriptor {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    value.kind === 'typeConstructor'
  );
}

function isSubNamespace(value: unknown): value is TypeNamespaceLevel {
  return typeof value === 'object' && value !== null && !('kind' in value);
}

function assertTypeChoiceValid(
  path: string,
  descriptor: AuthoringTypeChoiceDescriptor,
  contributedBy: string,
  level: TypeNamespaceLevel,
): void {
  const invalidError = (detail: string) =>
    runtimeError(
      'CONTRACT.PACK_CONTRIBUTION_INVALID',
      `Type choice "${path}" contributed by "${contributedBy}" ${detail}`,
      { packId: contributedBy, contribution: path },
    );
  const invalid = (detail: string): never => {
    throw invalidError(detail);
  };
  const constructorNamed = typeConstructorLookup(level);
  const options = descriptor.args.filter(isAuthoringTypeChoiceOption);
  const passed = descriptor.args.filter(
    (argument): argument is AuthoringTypeChoicePassedArgument =>
      !isAuthoringTypeChoiceOption(argument),
  );
  for (const option of options) {
    if (!option.values.includes(option.default)) {
      invalid(`defaults option "${option.name}" to ${option.default}, which it does not list.`);
    }
  }
  for (const row of descriptor.choices) {
    const covered =
      Object.keys(row.when).length === options.length &&
      options.every((option) => option.values.includes(row.when[option.name] ?? ''));
    if (!covered) {
      invalid(
        `has a row for ${typeChoiceCombinationText(row)}, which does not give every option one of its values.`,
      );
    }
    const names = options.map((option) => option.name);
    const chosen = new Map(Object.entries(row.when));
    if (descriptor.choices.filter((other) => rowMatches(other, chosen, names)).length > 1) {
      invalid(
        `has two rows for ${typeChoiceCombinationText(row)}; each combination chooses one type.`,
      );
    }
    const chosenType = constructorNamed(row.type);
    if (chosenType === undefined) {
      throw invalidError(
        `chooses "${row.type}", which is not a type constructor any component registers beside it.`,
      );
    }
    for (const name of Object.keys(row.defaults ?? {})) {
      if (!passed.some((argument) => argument.name === name)) {
        invalid(`gives a default for "${name}", which is not an argument it passes on.`);
      }
      if (!chosenType.args?.some((parameter) => parameter.name === name)) {
        invalid(
          `gives a default for "${name}" to "${row.type}", which takes no argument of that name.`,
        );
      }
    }
    for (const argument of passed) {
      const parameter = chosenType.args?.find((candidate) => candidate.name === argument.name);
      if (parameter?.kind === 'value' && parameter.dataType !== argument.dataType) {
        invalid(
          `passes "${argument.name}" as a value of data type "${argument.dataType}" to "${row.type}", which takes "${parameter.dataType}".`,
        );
      }
    }
  }
  const defaults: AuthoringTypeChoiceRow = {
    when: Object.fromEntries(options.map((option) => [option.name, option.default])),
    type: '',
  };
  const names = options.map((option) => option.name);
  const chosen = new Map(Object.entries(defaults.when));
  if (!descriptor.choices.some((row) => rowMatches(row, chosen, names))) {
    invalid(
      `has no row for its defaults ${typeChoiceCombinationText(defaults)}, so it cannot be written bare.`,
    );
  }
}

/**
 * Refuses a type choice of a component's `contributed` type namespace whose table cannot be resolved: a row that names no type constructor at the same level of the `assembled` namespace, a combination or default an option does not list, defaults with no row, a parameter default for an argument it does not pass on, or a passed-on argument of another data type than the constructor takes.
 */
export function assertTypeChoicesValid(
  contributed: TypeNamespaceLevel,
  contributedBy: string,
  assembled: TypeNamespaceLevel,
  path: readonly string[] = [],
): void {
  for (const [name, value] of Object.entries(contributed)) {
    const currentPath = [...path, name];
    if (isTypeChoice(value)) {
      assertTypeChoiceValid(currentPath.join('.'), value, contributedBy, assembled);
      continue;
    }
    const assembledLevel = Object.hasOwn(assembled, name) ? assembled[name] : undefined;
    if (isSubNamespace(value) && isSubNamespace(assembledLevel)) {
      assertTypeChoicesValid(value, contributedBy, assembledLevel, currentPath);
    }
  }
}
