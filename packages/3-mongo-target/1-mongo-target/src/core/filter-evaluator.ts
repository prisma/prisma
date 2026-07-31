import type {
  MongoAndExpr,
  MongoExistsExpr,
  MongoExprFilter,
  MongoFieldFilter,
  MongoFilterExpr,
  MongoFilterVisitor,
  MongoNotExpr,
  MongoOrExpr,
} from '@internal/mongo-query-ast/control';
import { deepEqual } from '@internal/mongo-schema-ir';
import type { MongoValue } from '@internal/mongo-value';
import { mongoTargetError } from './mongo-target-errors';

function getNestedField(doc: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = doc;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    const record = current as Record<string, unknown>;
    if (!Object.hasOwn(record, part)) {
      return undefined;
    }
    current = record[part];
  }
  return current;
}

function evaluateFieldOp(op: string, actual: unknown, expected: MongoValue): boolean {
  switch (op) {
    case '$eq':
      return deepEqual(actual, expected);
    case '$ne':
      return !deepEqual(actual, expected);
    case '$gt':
      return typeof actual === typeof expected && (actual as number) > (expected as number);
    case '$gte':
      return typeof actual === typeof expected && (actual as number) >= (expected as number);
    case '$lt':
      return typeof actual === typeof expected && (actual as number) < (expected as number);
    case '$lte':
      return typeof actual === typeof expected && (actual as number) <= (expected as number);
    case '$in':
      return Array.isArray(expected) && expected.some((v) => deepEqual(actual, v));
    default:
      throw mongoTargetError(
        'MIGRATION.OPERATION_UNSUPPORTED',
        `Unsupported filter operator in migration check: ${op}`,
        { meta: { operator: op } },
      );
  }
}

export class FilterEvaluator implements MongoFilterVisitor<boolean> {
  private doc: Record<string, unknown> = {};

  evaluate(filter: MongoFilterExpr, doc: Record<string, unknown>): boolean {
    this.doc = doc;
    return filter.accept(this);
  }

  field(expr: MongoFieldFilter): boolean {
    const value = getNestedField(this.doc, expr.field);
    return evaluateFieldOp(expr.op, value, expr.value);
  }

  and(expr: MongoAndExpr): boolean {
    return expr.exprs.every((child) => child.accept(this));
  }

  or(expr: MongoOrExpr): boolean {
    return expr.exprs.some((child) => child.accept(this));
  }

  not(expr: MongoNotExpr): boolean {
    return !expr.expr.accept(this);
  }

  exists(expr: MongoExistsExpr): boolean {
    const has = getNestedField(this.doc, expr.field) !== undefined;
    return expr.exists ? has : !has;
  }

  expr(_expr: MongoExprFilter): boolean {
    throw mongoTargetError(
      'MIGRATION.OPERATION_UNSUPPORTED',
      'Aggregation expression filters are not supported in migration checks',
      { meta: { operator: '$expr' } },
    );
  }
}
