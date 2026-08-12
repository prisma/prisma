import type { ExtractCodecTypes } from '@internal/sql-contract/types';
import type {
  RawAffectedCountQuery,
  RawRowQuery,
  RawSqlBuilder,
  RawSqlInterpolation,
} from '@internal/sql-relational-core/expression';
import type { ResolveRow } from '../resolve';
import type { ScopeField } from '../scope';
import type { TableProxyContract } from './db';

/**
 * The output type a contract column reference carries, kept on a symbol key so
 * it cannot collide with a codec descriptor's own fields and never appears in
 * the value a caller writes.
 */
declare const columnOutput: unique symbol;

/**
 * A column of the contract, as a raw row spec reads it: the codec that decodes
 * it, whether it may be null, and the type the contract says it decodes to.
 *
 * The first two fields are the codec descriptor the target-agnostic raw
 * surface already accepts, so a reference is usable as a spec entry with no
 * translation.
 */
export interface ContractColumnRef<
  CodecId extends string = string,
  Nullable extends boolean = boolean,
  Output = unknown,
> {
  readonly codecId: CodecId;
  readonly nullable: Nullable;
  readonly [columnOutput]?: Output;
}

/** One entry of a contract-bound row spec. */
export type ContractRawSpecEntry =
  | string
  | { readonly codecId: string; readonly nullable?: boolean }
  | ContractColumnRef;

/** A contract-bound row spec: result-column name to the codec that decodes it. */
export type ContractRawRowSpec = Readonly<Record<string, ContractRawSpecEntry>>;

type EntryScopeField<Entry> = Entry extends string
  ? { codecId: Entry; nullable: false }
  : Entry extends { readonly codecId: infer Id extends string; readonly nullable?: infer N }
    ? { codecId: Id; nullable: [N] extends [true] ? true : false }
    : never;

type SpecScopeFields<Spec extends ContractRawRowSpec> = {
  [K in keyof Spec]: EntryScopeField<Spec[K]> extends infer F extends ScopeField ? F : never;
};

/**
 * The entries whose type the contract already resolved — column references.
 * Everything else resolves from its codec id through the codec-type map, the
 * same route the query builders take.
 */
type SpecPreResolved<Spec extends ContractRawRowSpec> = {
  [K in keyof Spec as typeof columnOutput extends keyof Spec[K] ? K : never]: NonNullable<
    Spec[K][typeof columnOutput & keyof Spec[K]]
  >;
};

/** The row a spec declares, resolved against the contract's codec types. */
export type RawRowFor<
  Spec extends ContractRawRowSpec,
  CodecTypes extends Record<string, { readonly output: unknown }>,
> = ResolveRow<SpecScopeFields<Spec>, CodecTypes, SpecPreResolved<Spec>>;

/**
 * A raw template bound to the contract: the same builder the target-agnostic
 * surface returns, with terminators that resolve their row type from the spec.
 */
export interface ContractRawBuilder<CodecTypes extends Record<string, { readonly output: unknown }>>
  extends RawSqlBuilder {
  returnsRow<Spec extends ContractRawRowSpec>(spec: Spec): RawRowQuery<RawRowFor<Spec, CodecTypes>>;
  affectedCount(): RawAffectedCountQuery;
}

/** The contract-bound raw tag, as `db.raw` exposes it. */
export type ContractRawTag<CodecTypes extends Record<string, { readonly output: unknown }>> = (
  strings: TemplateStringsArray,
  ...values: RawSqlInterpolation[]
) => ContractRawBuilder<CodecTypes>;

/** The raw tag for a contract, with its codec-type map already applied. */
export type RawTagFor<C extends TableProxyContract> = ContractRawTag<ExtractCodecTypes<C>>;
