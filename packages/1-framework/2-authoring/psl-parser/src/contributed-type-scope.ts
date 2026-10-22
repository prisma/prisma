import {
  type AuthoringFieldPresetDescriptor,
  type AuthoringTypeAliasDescriptor,
  type AuthoringTypeChoiceDescriptor,
  type AuthoringTypeConstructorDescriptor,
  isAuthoringTypeChoiceOption,
  resolveAuthoringTypeChoice,
} from '@internal/framework-components/authoring';
import { isInternalError } from '@internal/utils/internal-error';
import { notOk, ok, type Result } from '@internal/utils/result';
import type { ResolvedTypeConstructorCall } from './resolve';

export type ContributedTypeDescriptor =
  | AuthoringTypeConstructorDescriptor
  | AuthoringTypeAliasDescriptor
  | AuthoringTypeChoiceDescriptor
  | AuthoringFieldPresetDescriptor;

export type ContributedTypeNamespace = {
  readonly [name: string]: ContributedTypeDescriptor | ContributedTypeNamespace;
};

export interface ContributedTypeSymbol {
  readonly kind: 'contributedType';
  readonly name: string;
  readonly path: readonly string[];
  readonly descriptor: ContributedTypeDescriptor;
  /** For a type choice, the type constructors its rows name, by name, from the namespace that holds it. */
  readonly choiceTypes?: ReadonlyMap<string, AuthoringTypeConstructorDescriptor>;
}

/** A contributed type as a field or type alias uses it: the type, and the call it is written with, `undefined` when it is written bare. */
export interface ContributedTypeUse {
  readonly symbol: ContributedTypeSymbol;
  readonly call: ResolvedTypeConstructorCall | undefined;
}

export interface ContributedNamespaceSymbol {
  readonly kind: 'contributedNamespace';
  readonly name: string;
  readonly path: readonly string[];
  readonly members: ReadonlyMap<string, ContributedMember>;
}

export type ContributedMember = ContributedTypeSymbol | ContributedNamespaceSymbol;

export interface ContributedTypeScope {
  lookup(name: string): ContributedMember | undefined;
  entries(): Iterable<readonly [string, ContributedMember]>;
}

export function isContributedTypeDescriptor(
  value: ContributedTypeDescriptor | ContributedTypeNamespace,
): value is ContributedTypeDescriptor {
  return (
    'kind' in value &&
    (value.kind === 'typeConstructor' ||
      value.kind === 'typeAlias' ||
      value.kind === 'typeChoice' ||
      value.kind === 'fieldPreset')
  );
}

/** The bare-name values a call writes for the options of a type choice, by the choice's argument positions; every other argument is left out. */
function writtenOptions(
  descriptor: AuthoringTypeChoiceDescriptor,
  call: ResolvedTypeConstructorCall | undefined,
): readonly unknown[] {
  const positional = call?.args.filter((arg) => arg.kind === 'positional') ?? [];
  return descriptor.args.map((argument, index) => {
    if (!isAuthoringTypeChoiceOption(argument)) return undefined;
    const written =
      call?.args.find((arg) => arg.kind === 'named' && arg.name === argument.name) ??
      positional[index];
    return written?.value.trim();
  });
}

/** The type constructor a use of the type choice `descriptor` chooses from its options, or why it chooses none. */
export function chosenTypeConstructor(
  use: ContributedTypeUse,
  descriptor: AuthoringTypeChoiceDescriptor,
): Result<AuthoringTypeConstructorDescriptor, string> {
  const { choiceTypes, path } = use.symbol;
  try {
    return ok(
      resolveAuthoringTypeChoice({
        helperPath: path.join('.'),
        descriptor,
        args: writtenOptions(descriptor, use.call),
        constructorNamed: (name) => choiceTypes?.get(name),
      }).descriptor,
    );
  } catch (error) {
    if (isInternalError(error) || !(error instanceof Error)) throw error;
    return notOk(error.message);
  }
}

/** The codec a column typed by `use` is stored with; `undefined` for a type choice whose call chooses no type, which the column's resolution reports. */
export function contributedTypeCodecId(use: ContributedTypeUse): string | undefined {
  const { descriptor } = use.symbol;
  switch (descriptor.kind) {
    case 'typeAlias':
      return descriptor.output.type.codecId;
    case 'typeChoice': {
      const chosen = chosenTypeConstructor(use, descriptor);
      return chosen.ok ? chosen.value.output.codecId : undefined;
    }
    default:
      return descriptor.output.codecId;
  }
}

export function mergeContributedTypes(
  ...namespaces: readonly ContributedTypeNamespace[]
): ContributedTypeNamespace {
  const merged: Record<string, ContributedTypeDescriptor | ContributedTypeNamespace> = {};
  for (const namespace of namespaces) {
    for (const [name, value] of Object.entries(namespace)) {
      const existing = Object.hasOwn(merged, name) ? merged[name] : undefined;
      merged[name] =
        existing !== undefined &&
        !isContributedTypeDescriptor(existing) &&
        !isContributedTypeDescriptor(value)
          ? mergeContributedTypes(existing, value)
          : value;
    }
  }
  return merged;
}

export function contributedTypeScope(
  contributedTypes: ContributedTypeNamespace,
): ContributedTypeScope {
  const members = collect(contributedTypes, []);
  return {
    lookup(name) {
      return members.get(name);
    },
    entries() {
      return members.entries();
    },
  };
}

function collect(
  namespace: ContributedTypeNamespace,
  prefix: readonly string[],
): ReadonlyMap<string, ContributedMember> {
  const members = new Map<string, ContributedMember>();
  for (const [name, value] of Object.entries(namespace)) {
    const path = [...prefix, name];
    members.set(
      name,
      isContributedTypeDescriptor(value)
        ? {
            kind: 'contributedType',
            name,
            path,
            descriptor: value,
            ...(value.kind === 'typeChoice'
              ? { choiceTypes: choiceTypesOf(value, namespace) }
              : {}),
          }
        : { kind: 'contributedNamespace', name, path, members: collect(value, path) },
    );
  }
  return members;
}

function choiceTypesOf(
  descriptor: AuthoringTypeChoiceDescriptor,
  namespace: ContributedTypeNamespace,
): ReadonlyMap<string, AuthoringTypeConstructorDescriptor> {
  const types = new Map<string, AuthoringTypeConstructorDescriptor>();
  for (const { type } of descriptor.choices) {
    const member = Object.hasOwn(namespace, type) ? namespace[type] : undefined;
    if (
      member !== undefined &&
      isContributedTypeDescriptor(member) &&
      member.kind === 'typeConstructor'
    ) {
      types.set(type, member);
    }
  }
  return types;
}
