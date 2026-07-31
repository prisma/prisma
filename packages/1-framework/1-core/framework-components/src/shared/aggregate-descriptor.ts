/**
 * Aggregate descriptor vocabulary: the declarative mapping from `(aggregate operation, optional input codec)` to the identity and nullability of the aggregate's result.
 *
 * Result identity is operation- and target-specific, so it lives beside codec descriptors rather than on them: one input codec produces different results under different operations, and one operation produces different results on different targets.
 *
 * Components contribute descriptors through `types.codecTypes.aggregateDescriptors`. This module owns the declarative half of the protocol — the half emission reads and the half ownership validation keys on. Families extend {@link AggregateDescriptor} with their own lowering hook; because such a hook returns an expression and never a codec, a descriptor's declared `output` is the only source of result identity.
 */

import type { JsonValue } from '@prisma-next/contract/types';
import type { CodecRef, CodecTrait } from './codec-types';
import { isCodecTrait } from './codec-types';

/**
 * How a descriptor matches the value an aggregate consumes.
 *
 * - `none` — the operation consumes no value (counting entries).
 * - `codec` — the value's codec id matches exactly.
 * - `trait` — the value's codec advertises the trait.
 *
 * Exact codec matches win over trait matches during resolution.
 */
export type AggregateInputMatch =
  | { readonly kind: 'none' }
  | { readonly kind: 'codec'; readonly codecId: string }
  | { readonly kind: 'trait'; readonly trait: CodecTrait };

/**
 * Result identity that names its codec outright. The optional `typeParams` resolver derives the result's type parameters from the input reference; it cannot change which codec id the result carries.
 */
export interface NamedAggregateOutput {
  readonly kind: 'codec';
  readonly codecId: string;
  readonly typeParams?: (input: CodecRef | undefined) => JsonValue | undefined;
}

/** Result identity that reuses the matched input codec, type parameters included. */
export interface SelfAggregateOutput {
  readonly kind: 'self';
}

/** Declarative identity of the codec an aggregate's result carries. */
export type AggregateOutputCodec = SelfAggregateOutput | NamedAggregateOutput;

interface AggregateDescriptorBase {
  /** The aggregate operation this descriptor resolves (e.g. `count`, `sum`). */
  readonly operation: string;
  /** Whether the result can be null — declared, never inferred from the input's nullability. */
  readonly nullable: boolean;
}

/** Overload of an operation that consumes no value. Its result names a codec outright, there being no input codec to reuse. */
export interface NoInputAggregateDescriptor extends AggregateDescriptorBase {
  readonly input: { readonly kind: 'none' };
  readonly output: NamedAggregateOutput;
}

/** Overload of an operation over values whose codec matches by id or by trait. */
export interface ValueInputAggregateDescriptor extends AggregateDescriptorBase {
  readonly input:
    | { readonly kind: 'codec'; readonly codecId: string }
    | { readonly kind: 'trait'; readonly trait: CodecTrait };
  readonly output: AggregateOutputCodec;
}

/**
 * One `(operation, input)` overload of an aggregate operation.
 *
 * Each pair has exactly one contributor across a composed stack, so `count` over entries, `sum` over a numeric trait, and `sum` over one exact codec id are three independent descriptors that may come from three different components.
 */
export type AggregateDescriptor = NoInputAggregateDescriptor | ValueInputAggregateDescriptor;

/**
 * Ownership key of an `(operation, input)` pair. Two descriptors sharing a key are two contributors claiming one overload, which is a composition error.
 */
export function aggregateDescriptorKey(descriptor: AggregateDescriptor): string {
  switch (descriptor.input.kind) {
    case 'none':
      return `${descriptor.operation}:none`;
    case 'codec':
      return `${descriptor.operation}:codec:${descriptor.input.codecId}`;
    case 'trait':
      return `${descriptor.operation}:trait:${descriptor.input.trait}`;
  }
}

/** Whether `descriptor` is the overload of an operation that consumes no value — the case whose result always names a codec outright. */
export function isNoInputAggregateDescriptor(
  descriptor: AggregateDescriptor,
): descriptor is NoInputAggregateDescriptor {
  return descriptor.input.kind === 'none';
}

function isObjectLike(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isAggregateInputMatch(value: unknown): value is AggregateInputMatch {
  if (!isObjectLike(value) || !('kind' in value)) return false;
  switch (value.kind) {
    case 'none':
      return true;
    case 'codec':
      return 'codecId' in value && isNonEmptyString(value.codecId);
    case 'trait':
      return 'trait' in value && isCodecTrait(value.trait);
    default:
      return false;
  }
}

function isAggregateOutputCodec(value: unknown): value is AggregateOutputCodec {
  if (!isObjectLike(value) || !('kind' in value)) return false;
  switch (value.kind) {
    case 'self':
      return true;
    case 'codec':
      return (
        'codecId' in value &&
        isNonEmptyString(value.codecId) &&
        (!('typeParams' in value) ||
          value.typeParams === undefined ||
          typeof value.typeParams === 'function')
      );
    default:
      return false;
  }
}

/**
 * Structural validation of a contributed descriptor. Components assembled from JavaScript reach the contribution slot unchecked, so composition validates the shape once and every later read is a plain lookup.
 */
export function isAggregateDescriptor(value: unknown): value is AggregateDescriptor {
  if (!isObjectLike(value)) return false;
  if (!('operation' in value) || !isNonEmptyString(value.operation)) return false;
  if (!('nullable' in value) || typeof value.nullable !== 'boolean') return false;
  if (!('input' in value) || !isAggregateInputMatch(value.input)) return false;
  if (!('output' in value) || !isAggregateOutputCodec(value.output)) return false;
  return value.input.kind !== 'none' || value.output.kind === 'codec';
}
