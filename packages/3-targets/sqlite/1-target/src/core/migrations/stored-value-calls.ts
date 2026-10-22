import type { Contract } from '@internal/contract/types';
import { keptNameAdvice, type StoredValueRewrite } from '@internal/family-sql/control';
import type { CodecLookupWithDescriptors } from '@internal/framework-components/codec';
import {
  type EnumValueCoordinate,
  enumValueStatementText,
  type OpFactoryCall,
  type ResolvedEnumValueRenameStatement,
} from '@internal/framework-components/control';
import type { SqlStorage } from '@internal/sql-contract/types';
import { ifDefined } from '@internal/utils/defined';
import { RemoveStoredValueCall, ReplaceStoredValueCall } from './op-factory-call';

type StoredValueCall = ReplaceStoredValueCall | RemoveStoredValueCall;

/** What a planned stored value call is about, for its data-loss question. */
export interface StoredValueSubject {
  readonly enumValue: EnumValueCoordinate;
  readonly keepDataAdvice?: string;
}

/** The calls that carry out a plan's stored value rewrites, each with the rewrite it carries out. */
export function sqliteStoredValueCalls(
  rewrites: readonly StoredValueRewrite[],
  fromContract: Contract<SqlStorage> | null,
  codecs: Pick<CodecLookupWithDescriptors, 'descriptorFor'>,
): ReadonlyMap<StoredValueCall, StoredValueRewrite> {
  return new Map(
    rewrites.map((rewrite): readonly [StoredValueCall, StoredValueRewrite] => {
      const codec = { codecRef: rewrite.codecRef, codecs };
      return [
        rewrite.to === undefined
          ? new RemoveStoredValueCall(
              rewrite.table,
              rewrite.column,
              rewrite.from,
              codec,
              fromContract === null
                ? undefined
                : enumValueStatementText(fromContract, rewrite.enumValue),
            )
          : new ReplaceStoredValueCall(
              rewrite.table,
              rewrite.column,
              rewrite.from,
              rewrite.to,
              codec,
            ),
        rewrite,
      ];
    }),
  );
}

/**
 * The enum value each removal is about, with how to keep its data when the member keeps its name
 * and only its stored value changes: the replacement, written by hand.
 */
export function storedValueSubjects(
  calls: ReadonlyMap<StoredValueCall, StoredValueRewrite>,
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
            call.renderTypeScript(),
            new ReplaceStoredValueCall(
              call.tableName,
              call.columnName,
              rewrite.from,
              rewrite.keptName,
              call.codec,
            ).renderTypeScript(),
          );
    subjects.set(call, { enumValue: rewrite.enumValue, ...ifDefined('keepDataAdvice', advice) });
  }
  return subjects;
}

/** The positions of the stored value calls that carry out `statement`, among calls that each lower to one operation. */
export function storedValueOperationIndexes(
  firstIndex: number,
  calls: ReadonlyMap<StoredValueCall, StoredValueRewrite>,
  statement: ResolvedEnumValueRenameStatement,
): readonly number[] {
  return [...calls.values()].flatMap((rewrite, offset) =>
    rewrite.statement === statement ? [firstIndex + offset] : [],
  );
}
