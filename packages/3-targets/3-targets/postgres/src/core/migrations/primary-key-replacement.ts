import type { SchemaDiffIssue } from '@internal/framework-components/control';
import { issueOutcome } from '@internal/framework-components/control';
import {
  type PrimaryKey,
  RelationalSchemaNodeKind,
  type SqlForeignKeyIR,
} from '@internal/sql-schema-ir/types';
import { blindCast } from '@internal/utils/casts';
import type { PostgresDatabaseSchemaNode } from '../schema-ir/postgres-database-schema-node';
import { defaultForeignKeyName } from './default-constraint-names';
import {
  emissionSchemaName,
  fkSpecFromNode,
  issueNode,
  issueSchemaName,
  issueTableName,
  primaryKeyCalls,
} from './issue-planner';
import {
  AddForeignKeyCall,
  DropConstraintCall,
  type PostgresOpFactoryCall,
} from './op-factory-call';
import type { CallMigrationStrategy, StrategyContext } from './planner-strategies';

/** A foreign key the plan drops and adds back unchanged, identified by its table's schema, its table and its diff `id`. */
export interface ReplacedForeignKey {
  readonly ddlSchemaName: string;
  readonly tableName: string;
  readonly id: string;
}

interface ForeignKeyAt {
  readonly ddlSchemaName: string;
  readonly tableName: string;
  readonly foreignKey: SqlForeignKeyIR;
}

interface Replacement {
  readonly issue: SchemaDiffIssue;
  readonly ddlSchemaName: string;
  readonly tableName: string;
  readonly oldKey: PrimaryKey;
}

function replacementOf(issue: SchemaDiffIssue): Replacement | undefined {
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

function referencesKey(
  at: ForeignKeyAt,
  ddlSchemaName: string,
  tableName: string,
  keyColumns: readonly string[],
): boolean {
  const referencedSchema = at.foreignKey.resolvedReferencedNamespace ?? at.ddlSchemaName;
  return (
    referencedSchema === ddlSchemaName &&
    at.foreignKey.referencedTable === tableName &&
    sameColumnSet(at.foreignKey.referencedColumns, keyColumns)
  );
}

function hasOwnIssue(at: ForeignKeyAt, issues: readonly SchemaDiffIssue[]): boolean {
  return issues.some(
    (issue) =>
      issueNode(issue)?.nodeKind === RelationalSchemaNodeKind.foreignKey &&
      issueSchemaName(issue) === at.ddlSchemaName &&
      issueTableName(issue) === at.tableName &&
      issue.actual?.id === at.foreignKey.id,
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

/**
 * Plans a primary key whose columns change, or that is removed. Postgres refuses to drop a key while a foreign key depends on its index, so every foreign key of the start tree that references the old key's columns is dropped first, unless its own issue already drops it, and added back from the end tree when the end tree keeps it. The calls are bucketed: foreign key drops come first in the drop bucket, and re-added foreign keys come after the new key and unique constraints.
 */
export function primaryKeyReplacementStrategy(
  issues: readonly SchemaDiffIssue[],
  ctx: StrategyContext,
): ReturnType<CallMigrationStrategy> {
  const replacements = issues.flatMap((issue) => replacementOf(issue) ?? []);
  if (replacements.length === 0) return { kind: 'no_match' };

  const startForeignKeys = foreignKeysOf(ctx.startTree);
  const calls: PostgresOpFactoryCall[] = [];
  const replacedForeignKeys: ReplacedForeignKey[] = [];
  for (const { issue, ddlSchemaName, tableName, oldKey } of replacements) {
    for (const at of startForeignKeys) {
      if (!referencesKey(at, ddlSchemaName, tableName, oldKey.columns) || hasOwnIssue(at, issues)) {
        continue;
      }
      const schemaName = emissionSchemaName(ctx, at.ddlSchemaName);
      calls.push(
        new DropConstraintCall(
          schemaName,
          at.tableName,
          at.foreignKey.name ?? defaultForeignKeyName(at.tableName, at.foreignKey.columns),
          'foreignKey',
        ),
      );
      const kept = endForeignKey(ctx.endTree, at);
      if (kept !== undefined) {
        calls.push(
          new AddForeignKeyCall(schemaName, at.tableName, fkSpecFromNode(kept, at.tableName)),
        );
        replacedForeignKeys.push({
          ddlSchemaName: at.ddlSchemaName,
          tableName: at.tableName,
          id: at.foreignKey.id,
        });
      }
    }
    calls.push(...primaryKeyCalls(issue, emissionSchemaName(ctx, ddlSchemaName), tableName));
  }
  const consumed = new Set(replacements.map((replacement) => replacement.issue));
  return {
    kind: 'match',
    issues: issues.filter((issue) => !consumed.has(issue)),
    calls,
    replacedForeignKeys,
  };
}
