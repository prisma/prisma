import type { CodecRef, CodecTrait } from '@prisma-next/framework-components/codec';
import type { NamedAggregateOutput } from '@prisma-next/framework-components/components';
import {
  aggregateDescriptorKey,
  isNoInputAggregateDescriptor,
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
  readonly noInput: ResolvedSqlAggregate | undefined;
  readonly byCodecId: ReadonlyMap<string, SqlAggregateDescriptor>;
}

interface OperationContributions {
  readonly noInput: SqlAggregateDescriptor | undefined;
  readonly exact: Map<string, SqlAggregateDescriptor>;
  readonly traits: Array<{
    readonly descriptor: SqlAggregateDescriptor;
    readonly trait: CodecTrait;
  }>;
}

function emptyContributions(): OperationContributions {
  return { noInput: undefined, exact: new Map(), traits: [] };
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
  const contributionsByOperation = new Map<string, OperationContributions>();
  const claimedKeys = new Set<string>();

  for (const candidate of descriptors) {
    if (!isSqlAggregateDescriptor(candidate)) {
      throw structuredError(
        'RUNTIME.AGGREGATE_DESCRIPTOR_INVALID',
        `Contributed value ${describeCandidate(candidate)} is not a valid SQL aggregate descriptor.`,
        {
          why: 'Aggregate resolution reads a declared operation, input match, result codec, and nullability; a lowering hook, where present, must be callable.',
          fix: 'Declare `operation`, `input` (`none` / `codec` / `trait`), `output` (`self` / `codec`), and `nullable` on the descriptor.',
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

    const contributions = contributionsByOperation.get(candidate.operation) ?? emptyContributions();
    switch (candidate.input.kind) {
      case 'none':
        contributionsByOperation.set(candidate.operation, {
          ...contributions,
          noInput: candidate,
        });
        break;
      case 'codec':
        contributions.exact.set(candidate.input.codecId, candidate);
        contributionsByOperation.set(candidate.operation, contributions);
        break;
      case 'trait':
        contributions.traits.push({ descriptor: candidate, trait: candidate.input.trait });
        contributionsByOperation.set(candidate.operation, contributions);
        break;
    }
  }

  const tables = new Map<string, OperationTable>();
  for (const [operation, contributions] of contributionsByOperation) {
    tables.set(operation, {
      noInput: resolveNoInput(operation, contributions.noInput),
      byCodecId: settleCodecMatches(operation, contributions, codecDescriptors),
    });
  }

  return {
    resolve(operation: string, input?: CodecRef): ResolvedSqlAggregate | undefined {
      const table = tables.get(operation);
      if (table === undefined) return undefined;
      if (input === undefined) return table.noInput;

      const descriptor = table.byCodecId.get(input.codecId);
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

function resolveNoInput(
  operation: string,
  descriptor: SqlAggregateDescriptor | undefined,
): ResolvedSqlAggregate | undefined {
  if (descriptor === undefined || !isNoInputAggregateDescriptor(descriptor)) return undefined;
  return {
    operation,
    output: namedOutputRef(descriptor.output, undefined),
    nullable: descriptor.nullable,
    lower: descriptor.lower,
  };
}

/**
 * Settle, per codec id, which descriptor claims it: the exact match where one exists, otherwise the single trait descriptor whose trait the codec advertises.
 */
function settleCodecMatches(
  operation: string,
  contributions: OperationContributions,
  codecDescriptors: CodecDescriptorRegistry,
): ReadonlyMap<string, SqlAggregateDescriptor> {
  const byCodecId = new Map(contributions.exact);
  if (contributions.traits.length === 0) return byCodecId;

  for (const codecDescriptor of codecDescriptors.values()) {
    if (byCodecId.has(codecDescriptor.codecId)) continue;

    const matches = contributions.traits.filter((entry) =>
      codecDescriptor.traits.includes(entry.trait),
    );
    if (matches.length > 1) {
      const traits = matches.map((entry) => entry.trait);
      throw structuredError(
        'RUNTIME.AMBIGUOUS_AGGREGATE_DESCRIPTOR',
        `Ambiguous aggregate descriptors for '${operation}' over codec '${codecDescriptor.codecId}': traits ${traits.join(', ')} all claim it.`,
        {
          why: 'A codec advertising several claimed traits leaves the result codec undetermined.',
          fix: `Contribute an exact descriptor for '${operation}' over '${codecDescriptor.codecId}', or narrow the overlapping trait contributions.`,
          meta: { operation, codecId: codecDescriptor.codecId, traits },
        },
      );
    }
    const match = matches[0];
    if (match !== undefined) byCodecId.set(codecDescriptor.codecId, match.descriptor);
  }

  return byCodecId;
}

function describeCandidate(value: unknown): string {
  if (typeof value === 'object' && value !== null && 'operation' in value) {
    return `'${String(value.operation)}'`;
  }
  return `of type ${typeof value}`;
}
