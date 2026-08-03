import { AndExpr, type AnyExpression } from '@internal/sql-relational-core/ast';

export function combineWhereExprs(filters: readonly AnyExpression[]): AnyExpression | undefined {
  if (filters.length === 0) {
    return undefined;
  }

  if (filters.length === 1) {
    return filters[0];
  }

  return AndExpr.of(filters);
}
