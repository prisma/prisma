import type { Contract } from '@internal/contract/types';
import {
  keptNameAdvice,
  type StoredValueCodec,
  type StoredValueRewrite,
} from '@internal/family-sql/control';
import type { CodecLookupWithDescriptors } from '@internal/framework-components/codec';
import type {
  EnumValueCoordinate,
  OpFactoryCall,
  ResolvedEnumValueRenameStatement,
} from '@internal/framework-components/control';
import type { SqlStorage } from '@internal/sql-contract/types';
import { ifDefined } from '@internal/utils/defined';
import {
  type PostgresOpFactoryCall,
  RemoveStoredValueCall,
  ReplaceStoredValueCall,
} from './op-factory-call';
import type { CallMigrationStrategy } from './planner-strategies';
import { emissionSchemaForNamespace } from './resolve-ddl-schema';

/** What a planned stored value call is about, for its data-loss question. */
export interface StoredValueSubject {
  readonly enumValue: EnumValueCoordinate;
  readonly keepDataAdvice?: string;
}

/** The calls that carry out a plan's stored value rewrites, each with the rewrite it carries out. */
export function postgresStoredValueCalls(
  rewrites: readonly StoredValueRewrite[],
  contract: Contract<SqlStorage>,
  codecs: Pick<CodecLookupWithDescriptors, 'descriptorFor'>,
): ReadonlyMap<PostgresOpFactoryCall, StoredValueRewrite> {
  return new Map(
    rewrites.map((rewrite) => {
      const schemaName = emissionSchemaForNamespace(contract, rewrite.namespaceId);
      const codec: StoredValueCodec = { codecRef: rewrite.codecRef, codecs };
      const call =
        rewrite.to === undefined
          ? new RemoveStoredValueCall(
              schemaName,
              rewrite.table,
              rewrite.column,
              rewrite.from,
              rewrite.many,
              codec,
            )
          : new ReplaceStoredValueCall(
              schemaName,
              rewrite.table,
              rewrite.column,
              rewrite.from,
              rewrite.to,
              rewrite.many,
              codec,
            );
      return [call, rewrite] as const;
    }),
  );
}

/** Puts the stored value calls among the calls the diff plans, which order them. */
export function storedValueCallsStrategy(
  calls: readonly PostgresOpFactoryCall[],
): CallMigrationStrategy {
  return (issues) => (calls.length === 0 ? { kind: 'no_match' } : { kind: 'match', issues, calls });
}

/**
 * The enum value each removal is about, with how to keep its data when the member keeps its name
 * and only its stored value changes: the replacement, written by hand.
 */
export function storedValueSubjects(
  calls: ReadonlyMap<PostgresOpFactoryCall, StoredValueRewrite>,
  fromContract: Contract<SqlStorage> | null,
): ReadonlyMap<OpFactoryCall, StoredValueSubject> {
  const subjects = new Map<OpFactoryCall, StoredValueSubject>();
  for (const [call, rewrite] of calls) {
    if (!(call instanceof RemoveStoredValueCall)) continue;
    const advice =
      rewrite.keptName === undefined || fromContract === null
        ? undefined
        : keptNameAdvice(
            fromContract,
            rewrite,
            new ReplaceStoredValueCall(
              call.schemaName,
              call.tableName,
              call.columnName,
              rewrite.from,
              rewrite.keptName,
              call.many,
              call.codec,
            ).renderTypeScript(),
          );
    subjects.set(call, {
      enumValue: rewrite.enumValue,
      ...ifDefined('keepDataAdvice', advice),
    });
  }
  return subjects;
}

/** The positions, among the plan's operations, of the operations that carry out `statement`. */
export function storedValueOperationIndexes(
  planCalls: readonly PostgresOpFactoryCall[],
  calls: ReadonlyMap<PostgresOpFactoryCall, StoredValueRewrite>,
  statement: ResolvedEnumValueRenameStatement,
): readonly number[] {
  const indexes: number[] = [];
  let position = 0;
  for (const call of planCalls) {
    const rewrite = calls.get(call);
    if (rewrite?.statement === statement) indexes.push(position);
    position +=
      'companions' in call && Array.isArray(call.companions) ? 1 + call.companions.length : 1;
  }
  return indexes;
}
