import {
  isRecordArgs,
  MongoAggLiteral,
  MongoAggOperator,
} from '@internal/mongo-query-ast/execution';
import { describe, expect, it } from 'vitest';
import { fn } from '../src/expression-helpers';
import type {
  ArrayField,
  DateField,
  DocField,
  NumericField,
  StringField,
  TypedAggExpr,
} from '../src/types';

const d: TypedAggExpr<DocField> = {
  _field: { codecId: 'mongo/string@1', nullable: false },
  node: MongoAggLiteral.of('x'),
};

const s: TypedAggExpr<StringField> = {
  _field: { codecId: 'mongo/string@1', nullable: false } as StringField,
  node: MongoAggLiteral.of('x'),
};

const n: TypedAggExpr<NumericField> = {
  _field: { codecId: 'mongo/double@1', nullable: false } as NumericField,
  node: MongoAggLiteral.of(1),
};

const dt: TypedAggExpr<DateField> = {
  _field: { codecId: 'mongo/date@1', nullable: false } as DateField,
  node: MongoAggLiteral.of('2024-01-01'),
};

const arr: TypedAggExpr<ArrayField> = {
  _field: { codecId: 'mongo/array@1', nullable: false } as ArrayField,
  node: MongoAggLiteral.of([]),
};

describe('expression helpers — unary', () => {
  it.each([
    ['year', '$year'],
    ['month', '$month'],
    ['dayOfMonth', '$dayOfMonth'],
    ['hour', '$hour'],
    ['minute', '$minute'],
    ['second', '$second'],
    ['millisecond', '$millisecond'],
    ['toLower', '$toLower'],
    ['toUpper', '$toUpper'],
    ['size', '$size'],
    ['strLenCP', '$strLenCP'],
    ['strLenBytes', '$strLenBytes'],
    ['isArray', '$isArray'],
    ['anyElementTrue', '$anyElementTrue'],
    ['allElementsTrue', '$allElementsTrue'],
    ['typeOf', '$type'],
    ['toInt', '$toInt'],
    ['toLong', '$toLong'],
    ['toDouble', '$toDouble'],
    ['toDecimal', '$toDecimal'],
    ['toString_', '$toString'],
    ['toObjectId', '$toObjectId'],
    ['toBool', '$toBool'],
    ['toDate', '$toDate'],
    ['reverseArray', '$reverseArray'],
    ['objectToArray', '$objectToArray'],
    ['arrayToObject', '$arrayToObject'],
    ['firstElem', '$first'],
    ['lastElem', '$last'],
  ] as const)('fn.%s produces operator %s', (helperName, expectedOp) => {
    const helper = fn[helperName] as (a: TypedAggExpr<DocField>) => TypedAggExpr<DocField>;
    const result = helper(d);
    expect(result.node).toBeInstanceOf(MongoAggOperator);
    expect((result.node as MongoAggOperator).op).toBe(expectedOp);
  });
});

describe('expression helpers — positional multi-arg', () => {
  it.each([
    ['add', '$add'],
    ['subtract', '$subtract'],
    ['multiply', '$multiply'],
    ['divide', '$divide'],
    ['concat', '$concat'],
    ['substr', '$substr'],
    ['substrBytes', '$substrBytes'],
    ['cmp', '$cmp'],
    ['eq', '$eq'],
    ['ne', '$ne'],
    ['gt', '$gt'],
    ['gte', '$gte'],
    ['lt', '$lt'],
    ['lte', '$lte'],
    ['split', '$split'],
    ['arrayElemAt', '$arrayElemAt'],
    ['concatArrays', '$concatArrays'],
    ['isIn', '$in'],
    ['indexOfArray', '$indexOfArray'],
    ['slice', '$slice'],
    ['range', '$range'],
    ['setUnion', '$setUnion'],
    ['setIntersection', '$setIntersection'],
    ['setDifference', '$setDifference'],
    ['setEquals', '$setEquals'],
    ['setIsSubset', '$setIsSubset'],
  ] as const)('fn.%s produces operator %s with array args', (helperName, expectedOp) => {
    const helper = fn[helperName] as (...a: TypedAggExpr<DocField>[]) => TypedAggExpr<DocField>;
    const result = helper(d, d, d);
    expect(result.node).toBeInstanceOf(MongoAggOperator);
    const op = result.node as MongoAggOperator;
    expect(op.op).toBe(expectedOp);
    expect(Array.isArray(op.args)).toBe(true);
  });
});

describe('expression helpers — named-args', () => {
  it.each([
    ['dateToString', '$dateToString', { date: dt, format: s }],
    ['dateFromString', '$dateFromString', { dateString: s }],
    ['dateDiff', '$dateDiff', { startDate: dt, endDate: dt, unit: s }],
    ['dateAdd', '$dateAdd', { startDate: dt, unit: s, amount: n }],
    ['dateSubtract', '$dateSubtract', { startDate: dt, unit: s, amount: n }],
    ['dateTrunc', '$dateTrunc', { date: dt, unit: s }],
    ['trim', '$trim', { input: s }],
    ['ltrim', '$ltrim', { input: s }],
    ['rtrim', '$rtrim', { input: s }],
    ['regexMatch', '$regexMatch', { input: s, regex: s }],
    ['regexFind', '$regexFind', { input: s, regex: s }],
    ['regexFindAll', '$regexFindAll', { input: s, regex: s }],
    ['replaceOne', '$replaceOne', { input: s, find: s, replacement: s }],
    ['replaceAll', '$replaceAll', { input: s, find: s, replacement: s }],
    ['convert', '$convert', { input: d, to: s }],
    ['getField', '$getField', { field: s, input: d }],
    ['setField', '$setField', { field: s, input: d, value: d }],
  ] as const)(
    'fn.%s produces operator %s with record args containing correct keys',
    (helperName, expectedOp, args) => {
      // narrowed signatures make the union incompatible with a generic Record parameter; cast through unknown
      const helper = fn[helperName] as unknown as (
        a: Record<string, TypedAggExpr<DocField>>,
      ) => TypedAggExpr<DocField>;
      const result = helper(args);
      expect(result.node).toBeInstanceOf(MongoAggOperator);
      const op = result.node as MongoAggOperator;
      expect(op.op).toBe(expectedOp);
      expect(isRecordArgs(op.args)).toBe(true);
      const recordArgs = op.args as Readonly<Record<string, unknown>>;
      for (const key of Object.keys(args)) {
        expect(recordArgs).toHaveProperty(key);
      }
    },
  );

  it('fn.zip produces $zip with inputs as array of expressions', () => {
    const result = fn.zip({ inputs: [arr, arr] });
    expect(result.node).toBeInstanceOf(MongoAggOperator);
    const op = result.node as MongoAggOperator;
    expect(op.op).toBe('$zip');
    expect(isRecordArgs(op.args)).toBe(true);
    const recordArgs = op.args as Readonly<Record<string, unknown>>;
    expect(recordArgs).toHaveProperty('inputs');
    expect(Array.isArray(recordArgs['inputs'])).toBe(true);
    expect((recordArgs['inputs'] as unknown[]).length).toBe(2);
  });
});
