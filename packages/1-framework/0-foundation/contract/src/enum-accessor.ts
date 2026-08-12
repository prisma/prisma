import { blindCast } from '@internal/utils/casts';
import type { Contract } from './contract-types';
import type { ContractEnum } from './domain-types';
import type { JsonValue } from './types';

/**
 * Runtime view of a domain enum, built at the client from the emitted
 * `ContractEnum` JSON (codec-encoded `JsonValue` members, literal types erased).
 *
 * This deliberately mirrors the accessor shape of the authoring-time
 * `EnumTypeHandle` (in `contract-ts`) rather than reusing it: that handle carries
 * the literal value generics and lives in the authoring layer, which the
 * foundation layer cannot depend on. The two are the same surface seen from the
 * two planes — authoring (typed) and runtime (validated JSON).
 */
export interface EnumAccessor {
  readonly values: readonly JsonValue[];
  readonly names: readonly string[];
  readonly members: Readonly<Record<string, JsonValue>>;
  has(v: JsonValue): boolean;
  hasName(name: string): boolean;
  nameOf(v: JsonValue): string | undefined;
  ordinalOf(v: JsonValue): number;
}

export function createEnumAccessor(contractEnum: ContractEnum): EnumAccessor {
  const values = Object.freeze(contractEnum.members.map((m) => m.value));
  const names = Object.freeze(contractEnum.members.map((m) => m.name));
  const members: Readonly<Record<string, JsonValue>> = Object.freeze(
    Object.fromEntries(contractEnum.members.map((m) => [m.name, m.value])),
  );

  const valueSet = new Set(values);
  const nameSet = Object.freeze(new Set(names));
  const valueToName = new Map(contractEnum.members.map((m) => [m.value, m.name]));
  const valueToOrdinal = new Map(values.map((v, i) => [v, i]));

  return {
    values,
    names,
    members,
    has: (v: JsonValue) => valueSet.has(v),
    hasName: (name: string) => nameSet.has(name),
    nameOf: (v: JsonValue) => valueToName.get(v),
    ordinalOf: (v: JsonValue) => valueToOrdinal.get(v) ?? -1,
  };
}

export function buildEnumsMapForNamespace(
  domain: {
    readonly namespaces: Readonly<
      Record<string, { readonly enum?: Readonly<Record<string, ContractEnum>> }>
    >;
  },
  namespaceId: string,
): Record<string, EnumAccessor> {
  const result: Record<string, EnumAccessor> = {};
  const namespace = domain.namespaces[namespaceId];
  if (namespace?.enum) {
    for (const [name, contractEnum] of Object.entries(namespace.enum)) {
      result[name] = createEnumAccessor(contractEnum);
    }
  }
  return result;
}

export function buildNamespacedEnums<TContract extends Contract>(
  domain: TContract['domain'],
): NamespacedEnums<TContract> {
  const result: Record<string, Record<string, EnumAccessor>> = {};
  for (const namespaceId of Object.keys(domain.namespaces)) {
    result[namespaceId] = buildEnumsMapForNamespace(domain, namespaceId);
  }
  return blindCast<
    NamespacedEnums<TContract>,
    'built dynamically from domain.namespaces; the mapped-type shape cannot be proven statically'
  >(result);
}

type Present<T> = Exclude<T, undefined>;

type EnumMemberEntry = { readonly name: string; readonly value: JsonValue };
type EnumEntry = { readonly members: readonly EnumMemberEntry[] };

// Mapped over a bare type parameter so the mapped type is homomorphic — a
// readonly tuple of members yields a readonly tuple of values/names (array
// methods preserved), not a plain `{ 0: …; 1: … }` mapped object.
type MemberValues<Members> = {
  readonly [I in keyof Members]: Members[I] extends EnumMemberEntry ? Members[I]['value'] : never;
};

type MemberNames<Members> = {
  readonly [I in keyof Members]: Members[I] extends EnumMemberEntry ? Members[I]['name'] : never;
};

type EnumEntryValues<Entry extends EnumEntry> = MemberValues<Entry['members']>;

type EnumEntryNames<Entry extends EnumEntry> = MemberNames<Entry['members']>;

type EnumEntryMembers<Entry extends EnumEntry> = {
  readonly [M in Entry['members'][number] as M['name']]: M['value'];
};

export type ContractEnumAccessor<Entry extends EnumEntry> = {
  readonly values: EnumEntryValues<Entry>;
  readonly names: EnumEntryNames<Entry>;
  readonly members: EnumEntryMembers<Entry>;
  /** Returns true and narrows `v` to the enum's value union when `v` is a declared member value. */
  has(v: JsonValue): v is EnumEntryValues<Entry>[number];
  /** Returns true and narrows `name` to the enum's member-name union when `name` is a declared member name. */
  hasName(name: string): name is Extract<EnumEntryNames<Entry>[number], string>;
  nameOf(v: EnumEntryValues<Entry>[number]): string | undefined;
  ordinalOf(v: EnumEntryValues<Entry>[number]): number;
  /**
   * Type-only: the enum's value union. Absent at runtime — use `typeof X.Value`
   * to derive the type; never read `X.Value` as a value.
   */
  readonly Value: EnumEntryValues<Entry>[number];
};

/**
 * The value union for a `ContractEnumAccessor`.
 * Use in function signatures to accept any declared enum value without re-exporting
 * the member type alias from the accessor's generic entry.
 */
export type EnumValues<A> = A extends { readonly values: ReadonlyArray<infer V> } ? V : never;

/**
 * The member-name union for a `ContractEnumAccessor`.
 */
export type EnumMemberNames<A> = A extends { readonly names: ReadonlyArray<infer N> } ? N : never;

export type EnumEntriesToAccessors<Enums> = {
  readonly [K in keyof Enums]: Enums[K] extends EnumEntry ? ContractEnumAccessor<Enums[K]> : never;
};

type BuiltEnumAccessorsOf<TContract> = TContract extends {
  readonly enumAccessors?: infer A;
}
  ? Exclude<A, undefined>
  : Record<never, never>;

type NamespaceEnumEntries<TNamespace> = TNamespace extends {
  readonly enum?: infer E;
}
  ? unknown extends E
    ? Record<never, never>
    : Present<E>
  : Record<never, never>;

// When `enumAccessors` is present (TS-DSL contract), it is the sole source because merging
// both carriers would create conflicting `values` types for the same enum key.
export type NamespaceEnumAccessors<
  TContract extends Contract,
  NsId extends keyof TContract['domain']['namespaces'],
> = keyof BuiltEnumAccessorsOf<TContract> extends never
  ? EnumEntriesToAccessors<NamespaceEnumEntries<TContract['domain']['namespaces'][NsId]>>
  : BuiltEnumAccessorsOf<TContract>;

export type NamespacedEnums<TContract extends Contract> = {
  readonly [Ns in keyof TContract['domain']['namespaces']]: NamespaceEnumAccessors<TContract, Ns>;
};
