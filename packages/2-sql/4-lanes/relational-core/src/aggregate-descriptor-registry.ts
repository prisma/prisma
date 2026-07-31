import type { CodecRef } from '@prisma-next/framework-components/codec';
import type { NamedAggregateOutput } from '@prisma-next/framework-components/components';
import {
  aggregateDescriptorKey,
  isAnyInputAggregateDescriptor,
  isNoInputAggregateDescriptor,
  settleAggregateOverloads,
} from '@prisma-next/framework-components/components';
import { ifDefined } from '@prisma-next/utils/defined';
import { structuredError } from '@prisma-next/utils/structured-error';
import type { SqlAggregateDescriptor } from './aggregate-descriptor';
import { isSqlAggregateDescriptor } from './aggregate-descriptor';
import { frozenCodecRef } from './ast/codec-types';
import type {
  CodecDescriptorRegistry,
  ResolvedSqlAggregate,
  SqlAggregateDescriptorRegistry,
} from './query-lane-context';

interface OperationTable {
  /** What a call carrying no input resolves to: the no-input overload, else the input-agnostic one. */
  readonly withoutInput: ResolvedSqlAggregate | undefined;
  /** Per codec id, the overload settled from the exact and trait rungs. */
  readonly byCodecId: ReadonlyMap<string, SqlAggregateDescriptor>;
  /** The input-agnostic overload, consulted for an input no exact or trait rung claims. */
  readonly anyInput: SqlAggregateDescriptor | undefined;
}

function namedOutputRef(output: NamedAggregateOutput, input: CodecRef | undefined): CodecRef {
  return frozenCodecRef({
    codecId: output.codecId,
    ...ifDefined('typeParams', output.typeParams?.(input)),
  });
}

/**
 * Validate every contributed aggregate descriptor and settle its matches against the composed codec set.
 *
 * Validation covers the descriptor's own shape, a second claim on one `(operation, input)` pair, and two trait descriptors that both claim a registered codec for one operation — the last of which only a composed stack can detect, which is why it is settled here rather than at contribution.
 */
export function buildSqlAggregateDescriptorRegistry(
  descriptors: ReadonlyArray<unknown>,
  codecDescriptors: CodecDescriptorRegistry,
): SqlAggregateDescriptorRegistry {
  const validated: SqlAggregateDescriptor[] = [];
  const claimedKeys = new Set<string>();

  for (const candidate of descriptors) {
    if (!isSqlAggregateDescriptor(candidate)) {
      throw structuredError(
        'RUNTIME.AGGREGATE_DESCRIPTOR_INVALID',
        `Contributed value ${describeCandidate(candidate)} is not a valid SQL aggregate descriptor.`,
        {
          why: 'Aggregate resolution reads a declared operation, input match, result codec, and nullability; a lowering hook, where present, must be callable.',
          fix: 'Declare `operation`, `input` (`none` / `any` / `codec` / `trait`), `output` (`self` / `codec`), and `nullable` on the descriptor.',
          meta: { descriptor: describeCandidate(candidate) },
        },
      );
    }

    const key = aggregateDescriptorKey(candidate);
    if (claimedKeys.has(key)) {
      throw structuredError(
        'RUNTIME.DUPLICATE_AGGREGATE_DESCRIPTOR',
        `Duplicate aggregate descriptor for '${key}'.`,
        {
          why: 'Each operation/input pair resolves to exactly one result codec, so exactly one component may claim it.',
          fix: 'Remove the duplicate target, adapter, or extension contribution.',
          meta: { key },
        },
      );
    }
    claimedKeys.add(key);
    validated.push(candidate);
  }

  const settled = settleAggregateOverloads(validated, codecDescriptors.values());
  const ambiguity = settled.ambiguities[0];
  if (ambiguity !== undefined) {
    throw structuredError(
      'RUNTIME.AMBIGUOUS_AGGREGATE_DESCRIPTOR',
      `Ambiguous aggregate descriptors for '${ambiguity.operation}' over codec '${ambiguity.codecId}': traits ${ambiguity.traits.join(', ')} all claim it.`,
      {
        why: 'A codec advertising several claimed traits leaves the result codec undetermined.',
        fix: `Contribute an exact descriptor for '${ambiguity.operation}' over '${ambiguity.codecId}', or narrow the overlapping trait contributions.`,
        meta: {
          operation: ambiguity.operation,
          codecId: ambiguity.codecId,
          traits: ambiguity.traits,
        },
      },
    );
  }

  const tables = new Map<string, OperationTable>();
  for (const [operation, entry] of settled.operations) {
    tables.set(operation, {
      withoutInput:
        resolveWithoutInput(operation, entry.noInput) ??
        resolveWithoutInput(operation, entry.anyInput),
      byCodecId: entry.byCodecId,
      anyInput: entry.anyInput,
    });
  }

  return {
    resolve(operation: string, input?: CodecRef): ResolvedSqlAggregate | undefined {
      const table = tables.get(operation);
      if (table === undefined) return undefined;
      if (input === undefined) return table.withoutInput;

      const descriptor = table.byCodecId.get(input.codecId) ?? table.anyInput;
      if (descriptor === undefined) return undefined;

      return {
        operation,
        output:
          descriptor.output.kind === 'self'
            ? frozenCodecRef(input)
            : namedOutputRef(descriptor.output, input),
        nullable: descriptor.nullable,
        lower: descriptor.lower,
      };
    },
    *values(): IterableIterator<SqlAggregateDescriptor> {
      yield* validated;
    },
  };
}

/**
 * Resolve the overload that answers a call carrying no input. Both kinds that qualify name their result codec outright, there being no input codec to reuse.
 */
function resolveWithoutInput(
  operation: string,
  descriptor: SqlAggregateDescriptor | undefined,
): ResolvedSqlAggregate | undefined {
  if (descriptor === undefined) return undefined;
  if (!isNoInputAggregateDescriptor(descriptor) && !isAnyInputAggregateDescriptor(descriptor)) {
    return undefined;
  }
  return {
    operation,
    output: namedOutputRef(descriptor.output, undefined),
    nullable: descriptor.nullable,
    lower: descriptor.lower,
  };
}

function describeCandidate(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'operation' in value) {
    return `'${String(value.operation)}'`;
  }
  return `of type ${typeof value}`;
}
