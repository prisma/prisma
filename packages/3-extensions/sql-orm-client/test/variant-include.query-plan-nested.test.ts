import {
  BinaryExpr,
  ColumnRef,
  ProjectionItem,
  SelectAst,
  SubqueryExpr,
  TableSource,
} from '@internal/sql-relational-core/ast';
import { describe, expect, it } from 'vitest';
import { compileSelectWithIncludes } from '../src/query-plan-select';
import { emptyState } from '../src/types';
import { buildMixedPolyContract, getTestAggregates } from './helpers';
import {
  assigneeInclude,
  assigneeRows,
  childRowsFor,
  featureJoin,
  projection,
  rowAggregate,
  selectedState,
  tasksInclude,
} from './variant-include.query-plan-fixtures';

describe('nested variant-owned include correlation', () => {
  it('uses the joined MTI table in a normal polymorphic child select', () => {
    const contract = buildMixedPolyContract();
    const nested = {
      ...selectedState('id', 'title', 'type'),
      includes: [assigneeInclude('features')],
      variantName: 'Feature',
    };
    const plan = compileSelectWithIncludes(
      contract,
      getTestAggregates(),
      'public',
      'projects_tbl',
      { ...emptyState(), includes: [tasksInclude(nested)], selectedFields: ['name'] },
      'Project',
    );
    const childRows = childRowsFor(plan.ast, 'tasks');
    const assigneeAggregate = rowAggregate('assignee', assigneeRows('features', 'assignee_id'), [
      'id',
      'name',
    ]);

    expect(childRows).toEqual(
      SelectAst.from(TableSource.named('tasks', undefined, 'public'))
        .withProjection([
          projection('id', 'tasks', 'id', 'pg/int4@1'),
          projection('title', 'tasks', 'title', 'pg/text@1'),
          projection('type', 'tasks', 'type', 'pg/text@1'),
          ProjectionItem.of('assignee', SubqueryExpr.of(assigneeAggregate)),
        ])
        .withWhere(
          BinaryExpr.eq(ColumnRef.of('tasks', 'project_id'), ColumnRef.of('projects_tbl', 'id')),
        )
        .withJoins([featureJoin]),
    );
  });
});
