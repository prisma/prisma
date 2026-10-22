import type {
  MigrationOperationPolicy,
  SqlPlannerConflict,
  SqlPlannerConflictLocation,
} from '@internal/family-sql/control';
import type { SchemaDiffIssue } from '@internal/framework-components/control';
import { issueOutcome, orderIssuesByDependencies } from '@internal/framework-components/control';
import {
  RelationalSchemaNodeKind,
  type SqlColumnIR,
  type SqlForeignKeyIR,
  type SqlIndexIR,
  type SqlSchemaIR,
  type SqlSchemaIRNode,
  type SqlTableIR,
  type SqlUniqueIR,
  sqlColumnTypesEqual,
} from '@internal/sql-schema-ir/types';
import { blindCast } from '@internal/utils/casts';
import { notOk, ok, type Result } from '@internal/utils/result';
import { CONTROL_TABLE_NAMES } from '../control-tables';
import {
  columnDefaultOf,
  ddlColumnFromNode,
  tableConstraintsFromNode,
  uniqueName,
} from './column-ddl';
import {
  AddColumnCall,
  AddForeignKeyCall,
  AddUniqueCall,
  CreateIndexCall,
  CreateTableCall,
  DropColumnCall,
  DropForeignKeyCall,
  DropIndexCall,
  DropTableCall,
  DropUniqueCall,
  foreignKeySpecOf,
  type MysqlOpFactoryCall,
} from './op-factory-call';

/**
 * Drops each issue under a missing or extra node: the call for a table or column accounts for everything beneath it.
 */
export function coalesceSubtreeIssues(
  issues: readonly SchemaDiffIssue[],
): readonly SchemaDiffIssue[] {
  const collapsing = issues
    .filter((issue) => {
      const outcome = issueOutcome(issue);
      return outcome === 'not-found' || outcome === 'not-expected';
    })
    .map((issue) => issue.path);
  return issues.filter(
    (issue) =>
      !collapsing.some(
        (ancestor) =>
          issue.path.length > ancestor.length &&
          ancestor.every((segment, index) => issue.path[index] === segment),
      ),
  );
}

export function issueNode(issue: SchemaDiffIssue): SqlSchemaIRNode | undefined {
  const node = issue.expected ?? issue.actual;
  return node === undefined
    ? undefined
    : blindCast<
        SqlSchemaIRNode,
        'every node in a SQL schema diff tree is a SqlSchemaIRNode; nodeKind is its required discriminant'
      >(node);
}

function expectedNode<T>(issue: SchemaDiffIssue): T {
  return blindCast<T, 'a not-found or not-equal issue carries the expected node of its kind'>(
    issue.expected,
  );
}

function actualNode<T>(issue: SchemaDiffIssue): T {
  return blindCast<T, 'a not-expected or not-equal issue carries the actual node of its kind'>(
    issue.actual,
  );
}

function location(table: string | undefined, column?: string): SqlPlannerConflictLocation {
  return {
    entityKind: 'table',
    ...(table === undefined ? {} : { entityName: table }),
    ...(column === undefined ? {} : { column }),
  };
}

function placeOf(issue: SchemaDiffIssue, at: SqlPlannerConflictLocation | undefined): string {
  if (at?.entityName === undefined) return issue.path.slice(1).join('.');
  return at.column === undefined ? at.entityName : `${at.entityName}.${at.column}`;
}

/** The conflict for a change the MySQL planner does not plan yet. */
export function notYetSupported(
  kind: SqlPlannerConflict['kind'],
  change: string,
  issue: SchemaDiffIssue,
  conflictLocation?: SqlPlannerConflictLocation,
): SqlPlannerConflict {
  return {
    kind,
    summary: `${change} is not yet supported on MySQL (${placeOf(issue, conflictLocation)})`,
    why: 'The MySQL planner creates and drops tables, columns, indexes, unique constraints and foreign keys; it does not change a column, a default, a primary key or a CHECK constraint yet. Use `migration new` to write this change by hand.',
    ...(conflictLocation === undefined ? {} : { location: conflictLocation }),
  };
}

function createTableCalls(table: SqlTableIR): MysqlOpFactoryCall[] {
  return [
    new CreateTableCall(
      table.name,
      Object.values(table.columns).map(ddlColumnFromNode),
      tableConstraintsFromNode(table),
    ),
    ...table.indexes.flatMap((index) =>
      index.columns === undefined
        ? []
        : [new CreateIndexCall(table.name, index.name, index.columns, index.unique)],
    ),
    ...table.foreignKeys.map(
      (fk) => new AddForeignKeyCall(table.name, foreignKeySpecOf(fk, table.name)),
    ),
  ];
}

type Mapped = Result<readonly MysqlOpFactoryCall[], SqlPlannerConflict>;

function mapTableIssue(issue: SchemaDiffIssue): Mapped {
  switch (issueOutcome(issue)) {
    case 'not-found': {
      const table = expectedNode<SqlTableIR>(issue);
      const expression = table.indexes.find((index) => index.columns === undefined);
      return expression === undefined
        ? ok(createTableCalls(table))
        : notOk(
            notYetSupported(
              'indexIncompatible',
              'An expression index',
              issue,
              location(table.name),
            ),
          );
    }
    case 'not-expected': {
      const table = actualNode<SqlTableIR>(issue);
      return ok(CONTROL_TABLE_NAMES.has(table.name) ? [] : [new DropTableCall(table.name)]);
    }
    default:
      return notOk(notYetSupported('unsupportedOperation', 'Changing a table', issue));
  }
}

function mapColumnIssue(issue: SchemaDiffIssue, table: string): Mapped {
  switch (issueOutcome(issue)) {
    case 'not-found': {
      const column = expectedNode<SqlColumnIR>(issue);
      const columnDefault = columnDefaultOf(column);
      const hasValue =
        column.nullable ||
        (columnDefault !== undefined &&
          !(columnDefault.kind === 'function' && columnDefault.expression === 'autoincrement()'));
      return hasValue
        ? ok([new AddColumnCall(table, ddlColumnFromNode(column))])
        : notOk(
            notYetSupported(
              'nullabilityConflict',
              'Adding a required column without a default',
              issue,
              location(table, column.name),
            ),
          );
    }
    case 'not-expected':
      return ok([new DropColumnCall(table, actualNode<SqlColumnIR>(issue).name)]);
    default: {
      const expected = expectedNode<SqlColumnIR>(issue);
      const typesEqual = sqlColumnTypesEqual(expected, actualNode<SqlColumnIR>(issue));
      return notOk(
        notYetSupported(
          typesEqual ? 'nullabilityConflict' : 'typeMismatch',
          typesEqual ? "Changing a column's nullability" : "Changing a column's type",
          issue,
          location(table, expected.name),
        ),
      );
    }
  }
}

function mapIndexIssue(issue: SchemaDiffIssue, table: string): Mapped {
  switch (issueOutcome(issue)) {
    case 'not-found': {
      const index = expectedNode<SqlIndexIR>(issue);
      return index.columns === undefined
        ? notOk(notYetSupported('indexIncompatible', 'An expression index', issue, location(table)))
        : ok([new CreateIndexCall(table, index.name, index.columns, index.unique)]);
    }
    case 'not-expected':
      return ok([new DropIndexCall(table, actualNode<SqlIndexIR>(issue).name)]);
    default:
      return notOk(
        notYetSupported('indexIncompatible', 'Changing an index', issue, location(table)),
      );
  }
}

function mapUniqueIssue(issue: SchemaDiffIssue, table: string): Mapped {
  switch (issueOutcome(issue)) {
    case 'not-found': {
      const unique = expectedNode<SqlUniqueIR>(issue);
      return ok([new AddUniqueCall(table, uniqueName(table, unique), unique.columns)]);
    }
    case 'not-expected':
      return ok([new DropUniqueCall(table, uniqueName(table, actualNode<SqlUniqueIR>(issue)))]);
    default:
      return notOk(
        notYetSupported(
          'indexIncompatible',
          'Changing a unique constraint',
          issue,
          location(table),
        ),
      );
  }
}

function mapForeignKeyIssue(issue: SchemaDiffIssue, table: string): Mapped {
  switch (issueOutcome(issue)) {
    case 'not-found':
      return ok([
        new AddForeignKeyCall(table, foreignKeySpecOf(expectedNode<SqlForeignKeyIR>(issue), table)),
      ]);
    case 'not-expected':
      return ok([
        new DropForeignKeyCall(
          table,
          foreignKeySpecOf(actualNode<SqlForeignKeyIR>(issue), table).name,
        ),
      ]);
    default:
      return notOk(
        notYetSupported('foreignKeyConflict', 'Changing a foreign key', issue, location(table)),
      );
  }
}

export function mapIssueToCalls(issue: SchemaDiffIssue): Mapped {
  const node = issueNode(issue);
  const table = issue.path[1];
  if (node === undefined) {
    return notOk(notYetSupported('unsupportedOperation', 'A change with no node', issue));
  }
  if (node.nodeKind === RelationalSchemaNodeKind.table) return mapTableIssue(issue);
  if (table === undefined) {
    return notOk(notYetSupported('unsupportedOperation', `A ${node.nodeKind} change`, issue));
  }
  switch (node.nodeKind) {
    case RelationalSchemaNodeKind.column:
      return mapColumnIssue(issue, table);
    case RelationalSchemaNodeKind.index:
      return mapIndexIssue(issue, table);
    case RelationalSchemaNodeKind.unique:
      return mapUniqueIssue(issue, table);
    case RelationalSchemaNodeKind.foreignKey:
      return mapForeignKeyIssue(issue, table);
    case RelationalSchemaNodeKind.columnDefault:
      return notOk(
        notYetSupported(
          'unsupportedOperation',
          "Changing a column's default",
          issue,
          location(table),
        ),
      );
    case RelationalSchemaNodeKind.primaryKey:
      return notOk(
        notYetSupported('indexIncompatible', 'Changing a primary key', issue, location(table)),
      );
    case RelationalSchemaNodeKind.check:
      return notOk(
        notYetSupported('unsupportedOperation', 'A CHECK constraint', issue, location(table)),
      );
    default:
      return notOk(notYetSupported('unsupportedOperation', `A ${node.nodeKind} change`, issue));
  }
}

/**
 * The order calls run in: foreign keys are dropped before the tables, columns and indexes they use, and added after every table, column and index they need exists.
 */
const CALL_ORDER: readonly MysqlOpFactoryCall['factoryName'][] = [
  'dropForeignKey',
  'createTable',
  'addColumn',
  'addUnique',
  'createIndex',
  'addForeignKey',
  'dropUnique',
  'dropIndex',
  'dropColumn',
  'dropTable',
  'rawSql',
];

function locationOfCall(call: MysqlOpFactoryCall): SqlPlannerConflictLocation | undefined {
  return 'tableName' in call
    ? {
        entityKind: 'table',
        entityName: call.tableName,
        ...('columnName' in call ? { column: call.columnName } : {}),
        ...('indexName' in call ? { index: call.indexName } : {}),
      }
    : undefined;
}

export function conflictForDisallowedCall(
  call: MysqlOpFactoryCall,
  allowed: readonly string[],
): SqlPlannerConflict {
  const callLocation = locationOfCall(call);
  return {
    kind:
      call instanceof CreateIndexCall || call instanceof DropIndexCall
        ? 'indexIncompatible'
        : 'missingButNonAdditive',
    summary: `Operation "${call.label}" requires class "${call.operationClass}", but policy allows only: ${allowed.join(', ')}`,
    why: 'Use `migration new` to author a custom migration for this change.',
    refusedOperationClass: call.operationClass,
    ...(callLocation === undefined ? {} : { location: callLocation }),
  };
}

/** The calls that turn `actual` into `expected` for `issues`, in the order they run, or the conflicts that stop the plan. */
export function planIssues(input: {
  readonly issues: readonly SchemaDiffIssue[];
  readonly expected: SqlSchemaIR;
  readonly actual: SqlSchemaIR;
  readonly policy: MigrationOperationPolicy;
}): Result<readonly MysqlOpFactoryCall[], readonly SqlPlannerConflict[]> {
  const calls: MysqlOpFactoryCall[] = [];
  const conflicts: SqlPlannerConflict[] = [];
  const allowed = input.policy.allowedOperationClasses;
  for (const issue of orderIssuesByDependencies(input.issues)) {
    const mapped = mapIssueToCalls(issue);
    if (!mapped.ok) {
      conflicts.push(mapped.failure);
      continue;
    }
    for (const call of mapped.value) {
      if (allowed.includes(call.operationClass)) calls.push(call);
      else conflicts.push(conflictForDisallowedCall(call, allowed));
    }
  }
  if (conflicts.length > 0) return notOk(conflicts);
  return ok(
    CALL_ORDER.flatMap((factoryName) => calls.filter((call) => call.factoryName === factoryName)),
  );
}
