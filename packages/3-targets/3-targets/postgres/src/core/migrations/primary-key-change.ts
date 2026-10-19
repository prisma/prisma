import type { SqlPlannerConflict } from '@internal/family-sql/control';
import type { SchemaDiffIssue } from '@internal/framework-components/control';
import { issueOutcome } from '@internal/framework-components/control';
import {
  type PrimaryKey,
  RelationalSchemaNodeKind,
  type SqlForeignKeyIR,
} from '@internal/sql-schema-ir/types';
import { blindCast } from '@internal/utils/casts';
import type { PostgresDatabaseSchemaNode } from '../schema-ir/postgres-database-schema-node';
import { PostgresSchemaNodeKind } from '../schema-ir/schema-node-kinds';
import { defaultForeignKeyName, defaultPrimaryKeyName } from './default-constraint-names';
import {
  emissionSchemaName,
  fkSpecFromNode,
  issueNode,
  issueSchemaName,
  issueTableName,
} from './issue-planner';
import {
  AddForeignKeyCall,
  AddPrimaryKeyCall,
  DropConstraintCall,
  type PostgresOpFactoryCall,
} from './op-factory-call';
import type {
  CallMigrationStrategy,
  ForeignKeyDropAuthority,
  StrategyContext,
} from './planner-strategies';

interface ForeignKeyAt {
  readonly ddlSchemaName: string;
  readonly tableName: string;
  readonly foreignKey: SqlForeignKeyIR;
}

interface KeyChange {
  readonly issue: SchemaDiffIssue;
  readonly ddlSchemaName: string;
  readonly tableName: string;
  readonly oldKey: PrimaryKey;
}

function keyChangeOf(issue: SchemaDiffIssue): KeyChange | undefined {
  const ddlSchemaName = issueSchemaName(issue);
  const tableName = issueTableName(issue);
  if (
    issueNode(issue)?.nodeKind !== RelationalSchemaNodeKind.primaryKey ||
    issueOutcome(issue) === 'not-found' ||
    ddlSchemaName === undefined ||
    tableName === undefined
  ) {
    return undefined;
  }
  const oldKey = blindCast<
    PrimaryKey,
    'a not-equal or not-expected primary-key issue always carries the actual PrimaryKey node'
  >(issue.actual);
  return { issue, ddlSchemaName, tableName, oldKey };
}

function sameColumnSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((column) => right.includes(column));
}

function foreignKeysOf(tree: PostgresDatabaseSchemaNode): readonly ForeignKeyAt[] {
  return Object.values(tree.namespaces).flatMap((namespace) =>
    Object.values(namespace.tables).flatMap((table) =>
      table.foreignKeys.map((foreignKey) => ({
        ddlSchemaName: namespace.schemaName,
        tableName: table.name,
        foreignKey,
      })),
    ),
  );
}

function referencesKey(at: ForeignKeyAt, change: KeyChange): boolean {
  const referencedSchema = at.foreignKey.resolvedReferencedNamespace ?? at.ddlSchemaName;
  return (
    referencedSchema === change.ddlSchemaName &&
    at.foreignKey.referencedTable === change.tableName &&
    sameColumnSet(at.foreignKey.referencedColumns, change.oldKey.columns)
  );
}

function isTableIssueOf(issue: SchemaDiffIssue, at: ForeignKeyAt): boolean {
  return issueSchemaName(issue) === at.ddlSchemaName && issueTableName(issue) === at.tableName;
}

function hasOwnIssue(at: ForeignKeyAt, issues: readonly SchemaDiffIssue[]): boolean {
  return issues.some(
    (issue) =>
      issueNode(issue)?.nodeKind === RelationalSchemaNodeKind.foreignKey &&
      isTableIssueOf(issue, at) &&
      issue.actual?.id === at.foreignKey.id,
  );
}

function dropsTable(at: ForeignKeyAt, issues: readonly SchemaDiffIssue[]): boolean {
  return issues.some(
    (issue) =>
      issueNode(issue)?.nodeKind === PostgresSchemaNodeKind.table &&
      issueOutcome(issue) === 'not-expected' &&
      isTableIssueOf(issue, at),
  );
}

function endForeignKey(
  endTree: PostgresDatabaseSchemaNode,
  at: ForeignKeyAt,
): SqlForeignKeyIR | undefined {
  const namespace = Object.values(endTree.namespaces).find(
    (candidate) => candidate.schemaName === at.ddlSchemaName,
  );
  return namespace?.tables[at.tableName]?.foreignKeys.find(
    (foreignKey) => foreignKey.id === at.foreignKey.id,
  );
}

function foreignKeyName(at: ForeignKeyAt): string {
  return at.foreignKey.name ?? defaultForeignKeyName(at.tableName, at.foreignKey.columns);
}

function blockedKeyChange(
  change: KeyChange,
  at: ForeignKeyAt,
  reason: string,
  contractAdvice: string | undefined,
  declared: boolean,
): SqlPlannerConflict {
  const keyName = change.oldKey.name ?? defaultPrimaryKeyName(change.tableName);
  const name = foreignKeyName(at);
  const migrationPlanAdvice = `${contractAdvice === undefined ? '' : `${contractAdvice} and plan again, or `}write the change as its own migration with prisma migration new, dropping that foreign key before the key change and adding it back after it.`;
  return {
    kind: 'foreignKeyConflict',
    summary: `Primary key "${keyName}" on "${change.ddlSchemaName}"."${change.tableName}" cannot change while foreign key "${name}" on "${at.ddlSchemaName}"."${at.tableName}" references it, and ${reason}.`,
    why: `With migration plan, ${migrationPlanAdvice} ${declared ? 'With db update, drop that foreign key yourself and leave it out of the contract, run db update, then add the foreign key back to both if you still want it.' : 'With db update, drop that foreign key yourself, run db update, then add the foreign key back if you still want it.'}`,
    location: { entityKind: 'table', entityName: at.tableName, constraint: name },
  };
}

function refusalFor(
  change: KeyChange,
  at: ForeignKeyAt,
  authority: Exclude<ForeignKeyDropAuthority, 'allowed'>,
  declared: boolean,
): SqlPlannerConflict {
  const table = `"${at.ddlSchemaName}"."${at.tableName}"`;
  return authority === 'otherSpace'
    ? blockedKeyChange(change, at, `another contract space owns ${table}`, undefined, declared)
    : blockedKeyChange(
        change,
        at,
        `the control policy does not let this plan change ${table}`,
        `give ${table} a control policy that lets this plan change it`,
        declared,
      );
}

function keyCalls(change: KeyChange, ctx: StrategyContext): readonly PostgresOpFactoryCall[] {
  const schemaName = emissionSchemaName(ctx, change.ddlSchemaName);
  const drop = new DropConstraintCall(
    schemaName,
    change.tableName,
    change.oldKey.name ?? defaultPrimaryKeyName(change.tableName),
    'primaryKey',
  );
  if (issueOutcome(change.issue) === 'not-expected') return [drop];
  const newKey = blindCast<
    PrimaryKey,
    'a not-equal primary-key issue always carries the expected PrimaryKey node'
  >(change.issue.expected);
  return [
    drop,
    new AddPrimaryKeyCall(
      schemaName,
      change.tableName,
      newKey.name ?? defaultPrimaryKeyName(change.tableName),
      [...newKey.columns],
    ),
  ];
}

/**
 * Plans a primary key whose columns change, or that is removed: a drop of the old key, then an add of the new one. Postgres refuses to drop a key while a foreign key depends on its index, so every foreign key of the start tree that references the old key's columns is dropped first, unless its own issue already drops it, and added back from the end tree. The plan refuses the change instead when such a foreign key is on a table the control policy keeps it away from or another contract space owns, or when the end tree leaves the foreign key out and the plan does not drop its table.
 */
export function primaryKeyChangeStrategy(
  issues: readonly SchemaDiffIssue[],
  ctx: StrategyContext,
): ReturnType<CallMigrationStrategy> {
  const changes = issues.flatMap((issue) => keyChangeOf(issue) ?? []);
  if (changes.length === 0) return { kind: 'no_match' };

  const startForeignKeys = foreignKeysOf(ctx.startTree);
  const calls: PostgresOpFactoryCall[] = [];
  const conflicts: SqlPlannerConflict[] = [];
  for (const change of changes) {
    const changeCalls: PostgresOpFactoryCall[] = [];
    const changeConflicts: SqlPlannerConflict[] = [];
    for (const at of startForeignKeys) {
      if (!referencesKey(at, change) || hasOwnIssue(at, ctx.allIssues)) continue;
      const drop = new DropConstraintCall(
        emissionSchemaName(ctx, at.ddlSchemaName),
        at.tableName,
        foreignKeyName(at),
        'foreignKey',
      );
      const kept = endForeignKey(ctx.endTree, at);
      const authority = ctx.foreignKeyDropAuthority(at.ddlSchemaName, at.tableName, at.foreignKey);
      if (authority !== 'allowed') {
        changeConflicts.push(refusalFor(change, at, authority, kept !== undefined));
        continue;
      }
      if (kept !== undefined) {
        changeCalls.push(
          drop,
          new AddForeignKeyCall(drop.schemaName, at.tableName, fkSpecFromNode(kept, at.tableName)),
        );
      } else if (dropsTable(at, ctx.allIssues)) {
        changeCalls.push(drop);
      } else {
        changeConflicts.push(
          blockedKeyChange(
            change,
            at,
            `the end contract has no such foreign key while this plan does not drop "${at.ddlSchemaName}"."${at.tableName}"`,
            'keep that foreign key in the contract',
            false,
          ),
        );
      }
    }
    if (changeConflicts.length > 0) {
      conflicts.push(...changeConflicts);
    } else {
      calls.push(...changeCalls, ...keyCalls(change, ctx));
    }
  }
  const consumed = new Set(changes.map((change) => change.issue));
  return {
    kind: 'match',
    issues: issues.filter((issue) => !consumed.has(issue)),
    calls,
    conflicts,
  };
}
