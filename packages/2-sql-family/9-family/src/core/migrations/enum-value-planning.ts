import {
  asNamespaceId,
  type Contract,
  type ContractEnum,
  type JsonValue,
} from '@internal/contract/types';
import type { CodecLookupWithDescriptors, CodecRef } from '@internal/framework-components/codec';
import { codecForRef, readContractValue } from '@internal/framework-components/codec';
import {
  type AppliedMigrationStatement,
  type EnumValueCoordinate,
  enumValueStatementText,
  type ResolvedEnumValueRenameStatement,
  type ResolvedMigrationStatement,
} from '@internal/framework-components/control';
import type { SqlStorage } from '@internal/sql-contract/types';
import { notOk, ok, type Result } from '@internal/utils/result';
import { structuredError } from '@internal/utils/structured-error';
import { buildColumnCodecRef } from './contract-to-schema-ir';
import type { SchemaTables } from './schema-tables';
import { isSqlModelStorage, tableControlPolicy } from './statement-planning';
import type { SqlPlannerConflict } from './types';

/** A stored value of an enum: the only values a rewrite compares and writes. */
export type StoredEnumValue = string | number;

/**
 * One column's rewrite of one stored value of an enum: `to` replaces `from`, or, when `to` is
 * absent, `from` is removed. The column is named as the destination contract stores it.
 */
export interface StoredValueRewrite {
  /** The enum value whose stored value is rewritten, as the origin contract names it. */
  readonly enumValue: EnumValueCoordinate;
  readonly namespaceId: string;
  readonly table: string;
  readonly column: string;
  /** The column's codec, which writes `from` and `to` as the database stores them. */
  readonly codecRef: CodecRef;
  /** Whether the column holds a list of the enum's values. */
  readonly many: boolean;
  readonly from: StoredEnumValue;
  readonly to: StoredEnumValue | undefined;
  /** The rename statement the rewrite carries out, if any. */
  readonly statement: ResolvedEnumValueRenameStatement | undefined;
  /** The stored value the member now has, when only its stored value changed. */
  readonly keptName: StoredEnumValue | undefined;
}

interface EnumColumn {
  readonly namespaceId: string;
  readonly table: string;
  readonly column: string;
  readonly codecRef: StoredValueRewrite['codecRef'];
  readonly many: boolean;
}

function sameValue(left: JsonValue, right: JsonValue): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function enumOf(
  contract: Contract<SqlStorage>,
  namespaceId: string,
  name: string,
): ContractEnum | undefined {
  return contract.domain.namespaces[namespaceId]?.enum?.[name];
}

/** The columns of the destination whose fields the enum types, in managed tables. */
function columnsTypedBy(
  contract: Contract<SqlStorage>,
  namespaceId: string,
  enumName: string,
): readonly EnumColumn[] {
  const found = new Map<string, EnumColumn>();
  for (const namespace of Object.values(contract.domain.namespaces)) {
    for (const model of Object.values(namespace.models)) {
      const { storage } = model;
      if (!isSqlModelStorage(storage)) continue;
      for (const [fieldName, field] of Object.entries(model.fields)) {
        const ref = field.valueSet;
        if (
          ref === undefined ||
          ref.plane !== 'domain' ||
          ref.entityKind !== 'enum' ||
          ref.spaceId !== undefined ||
          ref.namespaceId !== namespaceId ||
          ref.entityName !== enumName
        ) {
          continue;
        }
        const column = storage.fields[fieldName]?.column;
        if (column === undefined) continue;
        const stored =
          contract.storage.namespaces[storage.namespaceId]?.entries.table?.[storage.table]?.columns[
            column
          ];
        if (stored === undefined) continue;
        const location = { namespaceId: storage.namespaceId, table: storage.table };
        if (tableControlPolicy(contract, location) !== 'managed') continue;
        found.set(JSON.stringify([storage.namespaceId, storage.table, column]), {
          ...location,
          column,
          codecRef: buildColumnCodecRef(stored, undefined),
          many: stored.many !== false && stored.many !== undefined,
        });
      }
    }
  }
  return [...found.values()];
}

function isStoredEnumValue(value: JsonValue): value is StoredEnumValue {
  return typeof value === 'string' || typeof value === 'number';
}

function valueText(value: JsonValue): string {
  return JSON.stringify(value);
}

function unsupportedValue(
  contract: Contract<SqlStorage>,
  value: EnumValueCoordinate,
  stored: JsonValue,
): SqlPlannerConflict {
  const text = enumValueStatementText(contract, value);
  return {
    kind: 'unsupportedOperation',
    summary: `Cannot rewrite enum value "${text}": its stored value ${valueText(stored)} is not a string or a number`,
    why: `The plan rewrites the rows that hold a removed or renamed enum value, and it compares only string and number values. Rewrite the rows that hold enum value "${text}" yourself, then plan again.`,
  };
}

function stillStoredRefusal(
  statement: ResolvedEnumValueRenameStatement,
  fromContract: Contract<SqlStorage>,
  contract: Contract<SqlStorage>,
  stored: JsonValue,
  holder: string,
): SqlPlannerConflict {
  const holderText = enumValueStatementText(contract, { ...statement.to, member: holder });
  return {
    kind: 'statementRefused',
    summary: `Cannot rename enum value "${enumValueStatementText(fromContract, statement.from)}" to "${enumValueStatementText(contract, statement.to)}": the destination enum still stores ${valueText(stored)}, as enum value "${holderText}"`,
    why: `A rename changes the stored value in every row that holds it, so the rows that hold ${valueText(stored)} for "${holderText}" would change too. Leave out this statement.`,
    refusedStatement: statement,
  };
}

/**
 * The rewrites of stored enum values a plan makes. Enums are compared by the stored value of each
 * member: a stored value of the origin enum that the destination enum lacks is removed from every
 * column, in the working schema, whose field the destination enum types, unless a rename statement
 * names its member, which replaces it with the destination member's stored value instead. A member
 * renamed with its stored value kept rewrites nothing. With no origin contract, nothing is known to
 * have changed.
 */
export function planEnumValueRewrites(input: {
  readonly statements: readonly ResolvedMigrationStatement[];
  readonly fromContract: Contract<SqlStorage> | null;
  readonly contract: Contract<SqlStorage>;
  readonly tables: SchemaTables;
}): Result<readonly StoredValueRewrite[], SqlPlannerConflict> {
  const { fromContract, contract } = input;
  if (fromContract === null) return ok([]);
  const renamedNamespaces = new Map<string, string>();
  const valueRenames: ResolvedEnumValueRenameStatement[] = [];
  for (const statement of input.statements) {
    if (statement.kind !== 'rename') continue;
    if (statement.entity === 'namespace') renamedNamespaces.set(statement.from, statement.to);
    if (statement.entity === 'enumValue') valueRenames.push(statement);
  }
  const rewrites: StoredValueRewrite[] = [];
  for (const [originNamespace, namespace] of Object.entries(fromContract.domain.namespaces)) {
    for (const [enumName, originEnum] of Object.entries(namespace.enum ?? {})) {
      const namespaceId = renamedNamespaces.get(originNamespace) ?? originNamespace;
      const destinationEnum = enumOf(contract, namespaceId, enumName);
      if (destinationEnum === undefined) continue;
      const columns = columnsTypedBy(contract, namespaceId, enumName).filter((column) =>
        input.tables.hasColumn(column.namespaceId, column.table, column.column),
      );
      for (const member of originEnum.members) {
        const enumValue: EnumValueCoordinate = {
          namespaceId: asNamespaceId(originNamespace),
          enum: enumName,
          member: member.name,
        };
        const statement = valueRenames.find(
          (rename) =>
            rename.from.namespaceId === originNamespace &&
            rename.from.enum === enumName &&
            rename.from.member === member.name,
        );
        const holder = destinationEnum.members.find(({ value }) => sameValue(value, member.value));
        if (statement !== undefined) {
          const target = destinationEnum.members.find(({ name }) => name === statement.to.member);
          if (target === undefined || sameValue(target.value, member.value)) continue;
          if (holder !== undefined) {
            return notOk(
              stillStoredRefusal(statement, fromContract, contract, member.value, holder.name),
            );
          }
          if (!isStoredEnumValue(member.value))
            return notOk(unsupportedValue(fromContract, enumValue, member.value));
          if (!isStoredEnumValue(target.value))
            return notOk(unsupportedValue(fromContract, enumValue, target.value));
          for (const column of columns) {
            rewrites.push({
              enumValue,
              ...column,
              from: member.value,
              to: target.value,
              statement,
              keptName: undefined,
            });
          }
          continue;
        }
        if (holder !== undefined || columns.length === 0) continue;
        if (!isStoredEnumValue(member.value))
          return notOk(unsupportedValue(fromContract, enumValue, member.value));
        const renamedValue = destinationEnum.members.find(
          ({ name }) => name === member.name,
        )?.value;
        const keptName =
          renamedValue !== undefined && isStoredEnumValue(renamedValue) ? renamedValue : undefined;
        for (const column of columns) {
          rewrites.push({
            enumValue,
            ...column,
            from: member.value,
            to: undefined,
            statement: undefined,
            keptName,
          });
        }
      }
    }
  }
  return ok(rewrites);
}

/**
 * How to keep the data a removal loses when the member keeps its name and only its stored value
 * changes: no statement can say that, so the user plans the change with `migration plan` and
 * replaces `removeCall` with `replaceCall`, the target's calls, in the migration.ts it writes.
 */
export function keptNameAdvice(
  contract: Contract<SqlStorage>,
  rewrite: StoredValueRewrite,
  removeCall: string,
  replaceCall: string,
): string {
  const text = enumValueStatementText(contract, rewrite.enumValue);
  return `Enum value "${text}" keeps its name with a new stored value, which a statement cannot say. To keep the data, plan the change with prisma migration plan --delete ${text}, replace ${removeCall} with ${replaceCall} in the migration.ts it writes, run node on that migration.ts so it writes ops.json, and apply it with prisma db migrate. db update cannot keep the data.`;
}

/**
 * How to keep the rows that hold a stored value of `enumValue` when its removal finds them in a
 * column that takes no NULL: rename the enum value, or replace the value in the migration.ts.
 */
export function rowsHoldingValueAdvice(
  enumValue: string,
  removeCall: string,
  replaceCall: string,
): string {
  return `to keep those rows, answer with --rename ${enumValue}:${enumValue.slice(0, enumValue.lastIndexOf('.'))}.<new name>, or plan the change with prisma migration plan and replace ${removeCall} with ${replaceCall} in the migration.ts it writes, where <stored value> is a value the column keeps`;
}

/**
 * The applied statements with each enum value rename given the operations its rewrites lowered
 * to, at their positions in the plan: the rewrites are ordered with the diff, not with the renames.
 */
export function withEnumValueOperations(
  applied: readonly AppliedMigrationStatement[],
  operationIndexesOf: (statement: ResolvedEnumValueRenameStatement) => readonly number[],
): readonly AppliedMigrationStatement[] {
  return applied.map(({ statement, operationIndexes }) =>
    statement.kind === 'rename' && statement.entity === 'enumValue'
      ? { statement, operationIndexes: operationIndexesOf(statement) }
      : { statement, operationIndexes },
  );
}

/** The codec of the column a stored value is in, and the stack's codecs, which build it. */
export interface StoredValueCodec {
  readonly codecRef: CodecRef;
  readonly codecs: Pick<CodecLookupWithDescriptors, 'descriptorFor'>;
}

/**
 * The value the database stores for `value`, a stored value as the contract writes it: the column's
 * codec reads it as a value of its data type and writes it with `toWire`, as a literal default is
 * written. With no codec, or one the stack does not have, the value is used as written.
 */
export async function encodeStoredValue(
  value: StoredEnumValue,
  codec: StoredValueCodec | undefined,
): Promise<StoredEnumValue> {
  if (codec === undefined) return value;
  const built = codecForRef(codec.codecs, codec.codecRef);
  if (built === undefined) return value;
  const wire: unknown = await built.toWire(
    readContractValue(built, value, codec.codecRef.typeParams),
    {},
  );
  if (typeof wire === 'string' || typeof wire === 'number') return wire;
  if (typeof wire === 'bigint') return wire.toString();
  throw structuredError(
    'CONTRACT.ARGUMENT_INVALID',
    `Codec ${codec.codecRef.codecId} writes the stored value ${JSON.stringify(value)} as neither a string nor a number, which a migration cannot compare`,
    { meta: { what: 'stored value', codecId: codec.codecRef.codecId } },
  );
}
