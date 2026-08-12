import { expectTypeOf } from 'vitest';
import { acc } from '../src/accumulator-helpers';
import type {
  ArrayField,
  DocField,
  NullableNumericField,
  NumericField,
  StringField,
  TypedAccumulatorExpr,
  TypedAggExpr,
} from '../src/types';

const d = {} as TypedAggExpr<DocField>;
const n = {} as TypedAggExpr<NumericField>;
const s = {} as TypedAggExpr<StringField>;

describe('accumulator helper types', () => {
  it('sum preserves input field type', () => {
    expectTypeOf(acc.sum(n)).toEqualTypeOf<TypedAccumulatorExpr<NumericField>>();
  });

  it('sum preserves non-double numeric codec', () => {
    type IntField = { readonly codecId: 'mongo/int@1'; readonly nullable: false };
    const intExpr = {} as TypedAggExpr<IntField>;
    expectTypeOf(acc.sum(intExpr)).toEqualTypeOf<TypedAccumulatorExpr<IntField>>();
  });

  it('stdDevPop returns NullableNumericField', () => {
    expectTypeOf(acc.stdDevPop(d)).toEqualTypeOf<TypedAccumulatorExpr<NullableNumericField>>();
  });

  it('stdDevSamp returns NullableNumericField', () => {
    expectTypeOf(acc.stdDevSamp(d)).toEqualTypeOf<TypedAccumulatorExpr<NullableNumericField>>();
  });

  it('firstN returns ArrayField', () => {
    expectTypeOf(acc.firstN({ input: d, n })).toEqualTypeOf<TypedAccumulatorExpr<ArrayField>>();
  });

  it('lastN returns ArrayField', () => {
    expectTypeOf(acc.lastN({ input: d, n })).toEqualTypeOf<TypedAccumulatorExpr<ArrayField>>();
  });

  it('maxN returns ArrayField', () => {
    expectTypeOf(acc.maxN({ input: d, n })).toEqualTypeOf<TypedAccumulatorExpr<ArrayField>>();
  });

  it('minN returns ArrayField', () => {
    expectTypeOf(acc.minN({ input: d, n })).toEqualTypeOf<TypedAccumulatorExpr<ArrayField>>();
  });

  it('top returns DocField', () => {
    expectTypeOf(acc.top({ output: d, sortBy: { score: -1 } })).toEqualTypeOf<
      TypedAccumulatorExpr<DocField>
    >();
  });

  it('bottom returns DocField', () => {
    expectTypeOf(acc.bottom({ output: d, sortBy: { score: -1 } })).toEqualTypeOf<
      TypedAccumulatorExpr<DocField>
    >();
  });

  it('topN returns ArrayField', () => {
    expectTypeOf(acc.topN({ output: d, sortBy: { score: -1 }, n })).toEqualTypeOf<
      TypedAccumulatorExpr<ArrayField>
    >();
  });

  it('bottomN returns ArrayField', () => {
    expectTypeOf(acc.bottomN({ output: d, sortBy: { score: -1 }, n })).toEqualTypeOf<
      TypedAccumulatorExpr<ArrayField>
    >();
  });

  it('rejects wrong type for firstN n key', () => {
    // @ts-expect-error — n requires NumericField, not StringField
    acc.firstN({ input: d, n: s });
  });

  it('rejects wrong type for topN n key', () => {
    // @ts-expect-error — n requires NumericField, not StringField
    acc.topN({ output: d, sortBy: { score: -1 }, n: s });
  });
});
