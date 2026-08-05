/**
 * The precedence rule that decides which aggregate overload serves which codec.
 *
 * The rule is one rule and has two consumers that must never disagree: the runtime registry a family builds to decode results, and the emitter that writes the result types into `contract.d.ts`. It lives here, beside the descriptor vocabulary, so both read the same implementation rather than two copies of the same paragraph.
 *
 * Settling is a pure function of the contributed overloads and the codecs they are settled against. It reports rather than throws: what an ambiguity or a duplicate claim means — a build failure, an emit failure — is the caller's to say.
 */

import type { AggregateDescriptor } from './aggregate-descriptor';
import { aggregateDescriptorKey } from './aggregate-descriptor';
import type { CodecTrait } from './codec-types';

/** What settling needs to know about a codec: its id, and the traits an overload can claim it by. */
export interface AggregateCodecTraits {
  readonly codecId: string;
  readonly traits: readonly CodecTrait[];
}

/** The overloads of one operation, settled: one per codec, plus the two that answer without a specific input. */
export interface SettledAggregateOperation<TDescriptor extends AggregateDescriptor> {
  /** The overload that serves each codec — its exact one where it has one, otherwise the single trait overload whose trait it carries. */
  readonly byCodecId: ReadonlyMap<string, TDescriptor>;
  /** The overload for a call that carries no input at all. */
  readonly noInput: TDescriptor | undefined;
  /** The overload for any input no exact or trait overload claims. */
  readonly anyInput: TDescriptor | undefined;
}

/** A codec that two trait overloads of one operation both claim, leaving its result codec undetermined. */
export interface AggregateOverloadAmbiguity {
  readonly operation: string;
  readonly codecId: string;
  readonly traits: readonly CodecTrait[];
}

/** An `(operation, input)` key two overloads both claim. The first claim is the one settled; the second is reported here. */
export interface AggregateOverloadDuplicate<TDescriptor extends AggregateDescriptor> {
  readonly operation: string;
  readonly key: string;
  readonly first: TDescriptor;
  readonly second: TDescriptor;
}

export interface SettledAggregateOverloads<TDescriptor extends AggregateDescriptor> {
  readonly operations: ReadonlyMap<string, SettledAggregateOperation<TDescriptor>>;
  readonly ambiguities: readonly AggregateOverloadAmbiguity[];
  readonly duplicates: readonly AggregateOverloadDuplicate<TDescriptor>[];
}

interface MutableOperation<TDescriptor extends AggregateDescriptor> {
  readonly exact: Map<string, TDescriptor>;
  readonly traits: Array<{ readonly descriptor: TDescriptor; readonly trait: CodecTrait }>;
  noInput: TDescriptor | undefined;
  anyInput: TDescriptor | undefined;
}

/**
 * Settle every contributed overload against `codecs`.
 *
 * Exact codec overloads win over trait overloads, and trait overloads are expanded only over the codecs given — so a caller that passes the codecs a stack actually composes cannot end up with a row for one it does not. An exact overload survives even for a codec outside that set, because naming a codec id is a claim that stands on its own.
 *
 * The input-agnostic overload is left unexpanded: it answers whatever the other two rungs do not, so materializing it per codec would say the same thing once per codec.
 *
 * A second claim on one `(operation, input)` key is reported as a duplicate and does not unseat the first; both production callers reject duplicates before settling, so the report guards a consumer that calls this directly.
 */
export function settleAggregateOverloads<TDescriptor extends AggregateDescriptor>(
  descriptors: readonly TDescriptor[],
  codecs: Iterable<AggregateCodecTraits>,
): SettledAggregateOverloads<TDescriptor> {
  const byOperation = new Map<string, MutableOperation<TDescriptor>>();
  const firstClaims = new Map<string, TDescriptor>();
  const duplicates: AggregateOverloadDuplicate<TDescriptor>[] = [];

  for (const descriptor of descriptors) {
    const key = aggregateDescriptorKey(descriptor);
    const first = firstClaims.get(key);
    if (first !== undefined) {
      duplicates.push({ operation: descriptor.operation, key, first, second: descriptor });
      continue;
    }
    firstClaims.set(key, descriptor);

    const entry = byOperation.get(descriptor.operation) ?? {
      exact: new Map<string, TDescriptor>(),
      traits: [],
      noInput: undefined,
      anyInput: undefined,
    };
    switch (descriptor.input.kind) {
      case 'none':
        entry.noInput = descriptor;
        break;
      case 'any':
        entry.anyInput = descriptor;
        break;
      case 'codec':
        entry.exact.set(descriptor.input.codecId, descriptor);
        break;
      case 'trait':
        entry.traits.push({ descriptor, trait: descriptor.input.trait });
        break;
    }
    byOperation.set(descriptor.operation, entry);
  }

  const codecList = [...codecs];
  const operations = new Map<string, SettledAggregateOperation<TDescriptor>>();
  const ambiguities: AggregateOverloadAmbiguity[] = [];

  for (const [operation, entry] of byOperation) {
    const byCodecId = new Map(entry.exact);

    for (const codec of codecList) {
      if (byCodecId.has(codec.codecId)) continue;

      const claims = entry.traits.filter((candidate) => codec.traits.includes(candidate.trait));
      if (claims.length > 1) {
        ambiguities.push({
          operation,
          codecId: codec.codecId,
          traits: claims.map((claim) => claim.trait),
        });
        continue;
      }
      const claim = claims[0];
      if (claim !== undefined) byCodecId.set(codec.codecId, claim.descriptor);
    }

    operations.set(operation, {
      byCodecId,
      noInput: entry.noInput,
      anyInput: entry.anyInput,
    });
  }

  return { operations, ambiguities, duplicates };
}
