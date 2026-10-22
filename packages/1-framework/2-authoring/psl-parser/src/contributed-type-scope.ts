import {
  type AuthoringFieldPresetDescriptor,
  type AuthoringTypeAliasDescriptor,
  type AuthoringTypeChoiceDescriptor,
  type AuthoringTypeConstructorDescriptor,
  type DataTypeSupport,
  resolveAuthoringTypeChoice,
  typeConstructorLookup,
} from '@internal/framework-components/authoring';
import { isInternalError } from '@internal/utils/internal-error';
import { notOk, ok, type Result } from '@internal/utils/result';
import { readPslHelperArgs } from './authoring-arguments';
import type { ResolvedTypeConstructorCall } from './resolve';

export type ContributedTypeDescriptor =
  | AuthoringTypeConstructorDescriptor
  | AuthoringTypeAliasDescriptor
  | AuthoringTypeChoiceDescriptor
  | AuthoringFieldPresetDescriptor;

export type ContributedTypeNamespace = {
  readonly [name: string]: ContributedTypeDescriptor | ContributedTypeNamespace;
};

interface ContributedTypeSymbolBase {
  readonly kind: 'contributedType';
  readonly name: string;
  readonly path: readonly string[];
}

/** A contributed type choice, with the type constructors its rows name, by name, from the namespace that holds it. */
export interface ContributedTypeChoiceSymbol extends ContributedTypeSymbolBase {
  readonly descriptor: AuthoringTypeChoiceDescriptor;
  readonly choiceTypes: ReadonlyMap<string, AuthoringTypeConstructorDescriptor>;
}

export type ContributedTypeSymbol =
  | (ContributedTypeSymbolBase & {
      readonly descriptor: Exclude<ContributedTypeDescriptor, AuthoringTypeChoiceDescriptor>;
    })
  | ContributedTypeChoiceSymbol;

export function isContributedTypeChoice(
  symbol: ContributedTypeSymbol,
): symbol is ContributedTypeChoiceSymbol {
  return symbol.descriptor.kind === 'typeChoice';
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

/** The type constructor a call of the type choice `symbol` chooses, reading the call as the column does, or why it chooses none. */
export function chosenTypeConstructor(
  symbol: ContributedTypeChoiceSymbol,
  call: ResolvedTypeConstructorCall | undefined,
  dataTypes: DataTypeSupport,
): Result<AuthoringTypeConstructorDescriptor, string> {
  const helperPath = symbol.path.join('.');
  const args = readPslHelperArgs({
    args: call?.args ?? [],
    descriptors: symbol.descriptor.args,
    dataTypes,
  });
  if (args === undefined) return notOk(`The arguments of ${helperPath} do not read.`);
  try {
    return ok(
      resolveAuthoringTypeChoice({
        helperPath,
        descriptor: symbol.descriptor,
        args,
        constructorNamed: (name) => symbol.choiceTypes.get(name),
      }).descriptor,
    );
  } catch (error) {
    if (isInternalError(error) || !(error instanceof Error)) throw error;
    return notOk(error.message);
  }
}

/** The codec a column typed by `use` is stored with; `undefined` for a type choice whose call chooses no type, which the column's resolution reports. */
export function contributedTypeCodecId(
  use: ContributedTypeUse,
  dataTypes: DataTypeSupport,
): string | undefined {
  const { symbol } = use;
  if (isContributedTypeChoice(symbol)) {
    const chosen = chosenTypeConstructor(symbol, use.call, dataTypes);
    return chosen.ok ? chosen.value.output.codecId : undefined;
  }
  const { descriptor } = symbol;
  return descriptor.kind === 'typeAlias'
    ? descriptor.output.type.codecId
    : descriptor.output.codecId;
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
        ? contributedTypeSymbol(name, path, value, namespace)
        : { kind: 'contributedNamespace', name, path, members: collect(value, path) },
    );
  }
  return members;
}

function contributedTypeSymbol(
  name: string,
  path: readonly string[],
  descriptor: ContributedTypeDescriptor,
  namespace: ContributedTypeNamespace,
): ContributedTypeSymbol {
  if (descriptor.kind !== 'typeChoice') return { kind: 'contributedType', name, path, descriptor };
  const constructorNamed = typeConstructorLookup(namespace);
  const choiceTypes = new Map<string, AuthoringTypeConstructorDescriptor>();
  for (const { type } of descriptor.choices) {
    const chosen = constructorNamed(type);
    if (chosen !== undefined) choiceTypes.set(type, chosen);
  }
  return { kind: 'contributedType', name, path, descriptor, choiceTypes };
}
