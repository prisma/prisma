import type { ContractWithDomain, NamespaceId } from '@internal/contract/types';
import { UNBOUND_NAMESPACE_ID } from '../ir/namespace';

/** A model: its namespace and its name as the contract source writes it, never a table name. */
export interface ModelCoordinate {
  readonly namespaceId: NamespaceId;
  readonly model: string;
}

/**
 * A field of a model, named as the contract's model keys it in `fields`. Whether that is the
 * field's name in the contract source or its stored name in every family is not settled yet.
 */
export interface FieldCoordinate extends ModelCoordinate {
  readonly field: string;
}

export interface ResolvedModelRenameStatement {
  readonly kind: 'rename';
  readonly entity: 'model';
  readonly from: ModelCoordinate;
  readonly to: ModelCoordinate;
}

export interface ResolvedFieldRenameStatement {
  readonly kind: 'rename';
  readonly entity: 'field';
  readonly from: FieldCoordinate;
  readonly to: FieldCoordinate;
}

/** A rename: `from` is a coordinate of the origin contract and `to` one of the destination contract. */
export type ResolvedRenameStatement = ResolvedModelRenameStatement | ResolvedFieldRenameStatement;

/** A field whose values the migration converts to its new type with code the user writes. */
export interface ResolvedFieldConvertStatement {
  readonly kind: 'convert';
  readonly entity: 'field';
  /** The field as the destination contract names it. */
  readonly field: FieldCoordinate;
}

/** A required field whose values in existing rows the migration fills with code the user writes. */
export interface ResolvedFieldBackfillStatement {
  readonly kind: 'backfill';
  readonly entity: 'field';
  /** The field as the destination contract names it. */
  readonly field: FieldCoordinate;
}

/**
 * A statement resolved against the origin and destination contracts into domain coordinates. `kind`
 * names what the statement asks the plan to do, and `entity` the kind of coordinate it names.
 */
export type ResolvedMigrationStatement =
  | ResolvedRenameStatement
  | ResolvedFieldConvertStatement
  | ResolvedFieldBackfillStatement;

export function isRenameStatement(
  statement: ResolvedMigrationStatement,
): statement is ResolvedRenameStatement {
  return statement.kind === 'rename';
}

/**
 * What an operation of a plan is about, in the contract's terms where the family can say: a model
 * or a field of the origin contract, or, when no model of the origin contract stores it, the name
 * the database knows it by. Told apart by `kind`, not by a statement's `entity`, because a storage
 * name is not an entity of the contract.
 */
export type MigrationSubject =
  | ({ readonly kind: 'model' } & ModelCoordinate)
  | ({ readonly kind: 'field' } & FieldCoordinate)
  | { readonly kind: 'storage'; readonly name: string };

/** A key that is equal for two subjects exactly when they name the same thing. */
export function migrationSubjectKey(subject: MigrationSubject): string {
  switch (subject.kind) {
    case 'model':
      return JSON.stringify(['model', subject.namespaceId, subject.model]);
    case 'field':
      return JSON.stringify(['field', subject.namespaceId, subject.model, subject.field]);
    case 'storage':
      return JSON.stringify(['storage', subject.name]);
  }
}

/** An operation of a plan, by its position in the plan's `operations`, and its subject. */
export interface MigrationOperationSubject {
  readonly operationIndex: number;
  readonly subject: MigrationSubject;
}

/** An operation that changes who can read or write the rows of its subject. */
export interface MigrationAccessChange extends MigrationOperationSubject {
  /**
   * True when it lets more people read or write, such as disabling row-level security; false when
   * the change can go either way, such as dropping a policy.
   */
  readonly widens: boolean;
}

/**
 * How an operation loses its subject's data: `drop` removes the subject, and `typeChange` keeps the
 * field but changes its type, which loses the values that do not fit the new one.
 */
export type MigrationDataLossKind = 'drop' | 'typeChange';

/** An operation that loses data: its subject, and how it loses that subject's data. */
export interface MigrationDataLoss extends MigrationOperationSubject {
  /** How the operation loses the data; absent when no planner says, as for an operation of a recorded migration. */
  readonly loss?: MigrationDataLossKind;
  /** The label of the planned call that loses the data, which names it while a slot of the plan is unfilled. */
  readonly label?: string;
}

/**
 * A required field a plan adds to a table that may have rows, which every existing row gets one temporary value for. A
 * backfill statement for the field fills them instead.
 */
export interface MigrationTemporaryValue extends MigrationOperationSubject {
  /** The value as the target writes it, such as `''` or `0`. */
  readonly value: string;
}

/**
 * What the operations of a plan lose, whose access they change, and which new required fields they
 * give a temporary value, each by its position in the plan.
 */
export interface MigrationPlanSubjects<
  TLoss extends MigrationDataLoss = MigrationDataLoss,
  TAccess extends MigrationAccessChange = MigrationAccessChange,
  TTemporary = MigrationTemporaryValue,
> {
  /** Each operation that loses data, in plan order, with what it loses. */
  readonly dataLoss: readonly TLoss[];
  /** Each operation that changes who can read or write data, in plan order, with what it is about. */
  readonly accessWidening: readonly TAccess[];
  /** Each new required field whose existing rows the plan gives a temporary value, in plan order. */
  readonly temporaryValues: readonly TTemporary[];
}

/**
 * A statement as a plan applied it: `operationIndexes` are the positions, in the plan's
 * `operations`, of the operations the statement accounts for, in plan order, and empty when the
 * storage did not change. Statements refer to operations by position because operation ids are
 * not unique within a plan.
 */
export interface AppliedMigrationStatement {
  readonly statement: ResolvedMigrationStatement;
  readonly operationIndexes: readonly number[];
}

/**
 * A model's name in messages: `namespace.Model`, or `Model` alone in the unbound namespace, whose
 * id is internal.
 */
export function modelDisplayName(coordinate: ModelCoordinate): string {
  return coordinate.namespaceId === UNBOUND_NAMESPACE_ID
    ? coordinate.model
    : `${coordinate.namespaceId}.${coordinate.model}`;
}

/** A model as a statement names it: with its namespace only when the contract has several. */
export function modelStatementText(
  contract: ContractWithDomain,
  coordinate: ModelCoordinate,
): string {
  return Object.keys(contract.domain.namespaces).length > 1
    ? modelDisplayName(coordinate)
    : coordinate.model;
}

/** A field as a statement names it, through its model: `User.age`, or `app.User.age` when the contract has several namespaces. */
export function fieldStatementText(contract: ContractWithDomain, field: FieldCoordinate): string {
  return `${modelStatementText(contract, field)}.${field.field}`;
}

/** A model coordinate in JSON output: `namespaceId` is left out for the unbound namespace. */
export interface ModelCoordinateJson {
  readonly namespaceId?: NamespaceId;
  readonly model: string;
}

/** A field coordinate in JSON output: `namespaceId` is left out for the unbound namespace. */
export interface FieldCoordinateJson extends ModelCoordinateJson {
  readonly field: string;
}

/** A resolved statement in JSON output, with each coordinate written as `*CoordinateJson`. */
export type MigrationStatementJson =
  | {
      readonly kind: 'rename';
      readonly entity: 'model';
      readonly from: ModelCoordinateJson;
      readonly to: ModelCoordinateJson;
    }
  | {
      readonly kind: 'rename';
      readonly entity: 'field';
      readonly from: FieldCoordinateJson;
      readonly to: FieldCoordinateJson;
    }
  | {
      readonly kind: 'convert' | 'backfill';
      readonly entity: 'field';
      readonly field: FieldCoordinateJson;
    };

/** A subject in JSON output: `namespaceId` is left out for the unbound namespace. */
export type MigrationSubjectJson =
  | ({ readonly kind: 'model' } & ModelCoordinateJson)
  | ({ readonly kind: 'field' } & FieldCoordinateJson)
  | { readonly kind: 'storage'; readonly name: string };

function coordinateJson<T extends ModelCoordinate>(
  coordinate: T,
): Omit<T, 'namespaceId'> & ModelCoordinateJson {
  if (coordinate.namespaceId !== UNBOUND_NAMESPACE_ID) return coordinate;
  const { namespaceId: _unbound, ...rest } = coordinate;
  return rest;
}

/** The statement as JSON output writes it. */
export function migrationStatementJson(
  statement: ResolvedMigrationStatement,
): MigrationStatementJson {
  switch (statement.kind) {
    case 'rename':
      return statement.entity === 'model'
        ? { ...statement, from: coordinateJson(statement.from), to: coordinateJson(statement.to) }
        : { ...statement, from: coordinateJson(statement.from), to: coordinateJson(statement.to) };
    case 'convert':
    case 'backfill':
      return { ...statement, field: coordinateJson(statement.field) };
  }
}

/** The subject as JSON output writes it. */
export function migrationSubjectJson(subject: MigrationSubject): MigrationSubjectJson {
  switch (subject.kind) {
    case 'model':
      return {
        kind: 'model',
        ...coordinateJson({ namespaceId: subject.namespaceId, model: subject.model }),
      };
    case 'field':
      return {
        kind: 'field',
        ...coordinateJson({
          namespaceId: subject.namespaceId,
          model: subject.model,
          field: subject.field,
        }),
      };
    case 'storage':
      return subject;
  }
}

/**
 * The text that reports a statement, in domain names: a model or field is named with its
 * namespace only when its contract has more than one. A renamed field is named through its model as
 * the destination contract names it, as the statement itself is written.
 */
export function describeMigrationStatement(
  statement: ResolvedMigrationStatement,
  fromContract: ContractWithDomain,
  contract: ContractWithDomain,
): string {
  if (statement.kind !== 'rename') {
    return `${statement.kind} field "${modelStatementText(contract, statement.field)}.${statement.field.field}"`;
  }
  if (statement.entity === 'model') {
    return `rename model "${modelStatementText(fromContract, statement.from)}" to "${modelStatementText(contract, statement.to)}"`;
  }
  const model = modelStatementText(contract, statement.to);
  return `rename field "${model}.${statement.from.field}" to "${model}.${statement.to.field}"`;
}
