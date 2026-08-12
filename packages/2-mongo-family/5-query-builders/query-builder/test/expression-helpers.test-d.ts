import { expectTypeOf } from 'vitest';
import { fn } from '../src/expression-helpers';
import type {
  ArrayField,
  BooleanField,
  DateField,
  DocField,
  NullableDocField,
  NumericField,
  StringField,
  TypedAggExpr,
} from '../src/types';

const d = {} as TypedAggExpr<DocField>;
const s = {} as TypedAggExpr<StringField>;
const n = {} as TypedAggExpr<NumericField>;
const dt = {} as TypedAggExpr<DateField>;
const b = {} as TypedAggExpr<BooleanField>;
const arr = {} as TypedAggExpr<ArrayField>;

describe('date helpers', () => {
  it('year returns NumericField', () => {
    expectTypeOf(fn.year(d)).toEqualTypeOf<TypedAggExpr<NumericField>>();
  });
  it('month returns NumericField', () => {
    expectTypeOf(fn.month(d)).toEqualTypeOf<TypedAggExpr<NumericField>>();
  });
  it('dayOfMonth returns NumericField', () => {
    expectTypeOf(fn.dayOfMonth(d)).toEqualTypeOf<TypedAggExpr<NumericField>>();
  });
  it('hour returns NumericField', () => {
    expectTypeOf(fn.hour(d)).toEqualTypeOf<TypedAggExpr<NumericField>>();
  });
  it('minute returns NumericField', () => {
    expectTypeOf(fn.minute(d)).toEqualTypeOf<TypedAggExpr<NumericField>>();
  });
  it('second returns NumericField', () => {
    expectTypeOf(fn.second(d)).toEqualTypeOf<TypedAggExpr<NumericField>>();
  });
  it('millisecond returns NumericField', () => {
    expectTypeOf(fn.millisecond(d)).toEqualTypeOf<TypedAggExpr<NumericField>>();
  });
  it('dateToString returns StringField', () => {
    expectTypeOf(fn.dateToString({ date: dt, format: s })).toEqualTypeOf<
      TypedAggExpr<StringField>
    >();
  });
  it('dateToString accepts optional keys', () => {
    expectTypeOf(fn.dateToString({ date: dt })).toEqualTypeOf<TypedAggExpr<StringField>>();
  });
  it('dateFromString returns DateField', () => {
    expectTypeOf(fn.dateFromString({ dateString: s })).toEqualTypeOf<TypedAggExpr<DateField>>();
  });
  it('dateDiff returns NumericField', () => {
    expectTypeOf(fn.dateDiff({ startDate: dt, endDate: dt, unit: s })).toEqualTypeOf<
      TypedAggExpr<NumericField>
    >();
  });
  it('dateAdd returns DateField', () => {
    expectTypeOf(fn.dateAdd({ startDate: dt, unit: s, amount: n })).toEqualTypeOf<
      TypedAggExpr<DateField>
    >();
  });
  it('dateSubtract returns DateField', () => {
    expectTypeOf(fn.dateSubtract({ startDate: dt, unit: s, amount: n })).toEqualTypeOf<
      TypedAggExpr<DateField>
    >();
  });
  it('dateTrunc returns DateField', () => {
    expectTypeOf(fn.dateTrunc({ date: dt, unit: s })).toEqualTypeOf<TypedAggExpr<DateField>>();
  });

  it('rejects wrong type for dateToString date key', () => {
    // @ts-expect-error — date requires DateField, not StringField
    fn.dateToString({ date: s });
  });
  it('rejects wrong type for dateAdd amount key', () => {
    // @ts-expect-error — amount requires NumericField, not StringField
    fn.dateAdd({ startDate: dt, unit: s, amount: s });
  });
});

describe('string helpers', () => {
  it('substr returns StringField', () => {
    expectTypeOf(fn.substr(d, d, d)).toEqualTypeOf<TypedAggExpr<StringField>>();
  });
  it('substrBytes returns StringField', () => {
    expectTypeOf(fn.substrBytes(d, d, d)).toEqualTypeOf<TypedAggExpr<StringField>>();
  });
  it('trim returns StringField', () => {
    expectTypeOf(fn.trim({ input: s })).toEqualTypeOf<TypedAggExpr<StringField>>();
  });
  it('ltrim returns StringField', () => {
    expectTypeOf(fn.ltrim({ input: s })).toEqualTypeOf<TypedAggExpr<StringField>>();
  });
  it('rtrim returns StringField', () => {
    expectTypeOf(fn.rtrim({ input: s })).toEqualTypeOf<TypedAggExpr<StringField>>();
  });
  it('split returns ArrayField', () => {
    expectTypeOf(fn.split(d, d)).toEqualTypeOf<TypedAggExpr<ArrayField>>();
  });
  it('strLenCP returns NumericField', () => {
    expectTypeOf(fn.strLenCP(d)).toEqualTypeOf<TypedAggExpr<NumericField>>();
  });
  it('strLenBytes returns NumericField', () => {
    expectTypeOf(fn.strLenBytes(d)).toEqualTypeOf<TypedAggExpr<NumericField>>();
  });
  it('regexMatch returns BooleanField', () => {
    expectTypeOf(fn.regexMatch({ input: s, regex: s })).toEqualTypeOf<TypedAggExpr<BooleanField>>();
  });
  it('regexFind returns DocField', () => {
    expectTypeOf(fn.regexFind({ input: s, regex: s })).toEqualTypeOf<TypedAggExpr<DocField>>();
  });
  it('regexFindAll returns ArrayField', () => {
    expectTypeOf(fn.regexFindAll({ input: s, regex: s })).toEqualTypeOf<TypedAggExpr<ArrayField>>();
  });
  it('replaceOne returns StringField', () => {
    expectTypeOf(fn.replaceOne({ input: s, find: s, replacement: s })).toEqualTypeOf<
      TypedAggExpr<StringField>
    >();
  });
  it('replaceAll returns StringField', () => {
    expectTypeOf(fn.replaceAll({ input: s, find: s, replacement: s })).toEqualTypeOf<
      TypedAggExpr<StringField>
    >();
  });

  it('rejects wrong type for trim input key', () => {
    // @ts-expect-error — input requires StringField, not NumericField
    fn.trim({ input: n });
  });
  it('rejects wrong type for regexMatch input key', () => {
    // @ts-expect-error — input requires StringField, not DateField
    fn.regexMatch({ input: dt, regex: s });
  });
});

describe('comparison helpers', () => {
  it('cmp returns NumericField', () => {
    expectTypeOf(fn.cmp(d, d)).toEqualTypeOf<TypedAggExpr<NumericField>>();
  });
  it('eq returns BooleanField', () => {
    expectTypeOf(fn.eq(d, d)).toEqualTypeOf<TypedAggExpr<BooleanField>>();
  });
  it('ne returns BooleanField', () => {
    expectTypeOf(fn.ne(d, d)).toEqualTypeOf<TypedAggExpr<BooleanField>>();
  });
  it('gt returns BooleanField', () => {
    expectTypeOf(fn.gt(d, d)).toEqualTypeOf<TypedAggExpr<BooleanField>>();
  });
  it('gte returns BooleanField', () => {
    expectTypeOf(fn.gte(d, d)).toEqualTypeOf<TypedAggExpr<BooleanField>>();
  });
  it('lt returns BooleanField', () => {
    expectTypeOf(fn.lt(d, d)).toEqualTypeOf<TypedAggExpr<BooleanField>>();
  });
  it('lte returns BooleanField', () => {
    expectTypeOf(fn.lte(d, d)).toEqualTypeOf<TypedAggExpr<BooleanField>>();
  });
});

describe('array helpers', () => {
  it('arrayElemAt returns NullableDocField', () => {
    expectTypeOf(fn.arrayElemAt(d, d)).toEqualTypeOf<TypedAggExpr<NullableDocField>>();
  });
  it('concatArrays returns ArrayField', () => {
    expectTypeOf(fn.concatArrays(d, d)).toEqualTypeOf<TypedAggExpr<ArrayField>>();
  });
  it('firstElem returns NullableDocField', () => {
    expectTypeOf(fn.firstElem(d)).toEqualTypeOf<TypedAggExpr<NullableDocField>>();
  });
  it('lastElem returns NullableDocField', () => {
    expectTypeOf(fn.lastElem(d)).toEqualTypeOf<TypedAggExpr<NullableDocField>>();
  });
  it('isIn returns BooleanField', () => {
    expectTypeOf(fn.isIn(d, d)).toEqualTypeOf<TypedAggExpr<BooleanField>>();
  });
  it('indexOfArray returns NumericField', () => {
    expectTypeOf(fn.indexOfArray(d, d)).toEqualTypeOf<TypedAggExpr<NumericField>>();
  });
  it('isArray returns BooleanField', () => {
    expectTypeOf(fn.isArray(d)).toEqualTypeOf<TypedAggExpr<BooleanField>>();
  });
  it('reverseArray returns ArrayField', () => {
    expectTypeOf(fn.reverseArray(d)).toEqualTypeOf<TypedAggExpr<ArrayField>>();
  });
  it('slice returns ArrayField', () => {
    expectTypeOf(fn.slice(d, d)).toEqualTypeOf<TypedAggExpr<ArrayField>>();
  });
  it('zip returns ArrayField', () => {
    expectTypeOf(fn.zip({ inputs: [arr, arr] })).toEqualTypeOf<TypedAggExpr<ArrayField>>();
  });
  it('range returns ArrayField', () => {
    expectTypeOf(fn.range(d, d, d)).toEqualTypeOf<TypedAggExpr<ArrayField>>();
  });

  it('rejects wrong type for zip inputs key', () => {
    // @ts-expect-error — inputs requires ArrayField[], not StringField
    fn.zip({ inputs: s });
  });
});

describe('set helpers', () => {
  it('setUnion returns ArrayField', () => {
    expectTypeOf(fn.setUnion(d, d)).toEqualTypeOf<TypedAggExpr<ArrayField>>();
  });
  it('setIntersection returns ArrayField', () => {
    expectTypeOf(fn.setIntersection(d, d)).toEqualTypeOf<TypedAggExpr<ArrayField>>();
  });
  it('setDifference returns ArrayField', () => {
    expectTypeOf(fn.setDifference(d, d)).toEqualTypeOf<TypedAggExpr<ArrayField>>();
  });
  it('setEquals returns BooleanField', () => {
    expectTypeOf(fn.setEquals(d, d)).toEqualTypeOf<TypedAggExpr<BooleanField>>();
  });
  it('setIsSubset returns BooleanField', () => {
    expectTypeOf(fn.setIsSubset(d, d)).toEqualTypeOf<TypedAggExpr<BooleanField>>();
  });
  it('anyElementTrue returns BooleanField', () => {
    expectTypeOf(fn.anyElementTrue(d)).toEqualTypeOf<TypedAggExpr<BooleanField>>();
  });
  it('allElementsTrue returns BooleanField', () => {
    expectTypeOf(fn.allElementsTrue(d)).toEqualTypeOf<TypedAggExpr<BooleanField>>();
  });
});

describe('type helpers', () => {
  it('typeOf returns StringField', () => {
    expectTypeOf(fn.typeOf(d)).toEqualTypeOf<TypedAggExpr<StringField>>();
  });
  it('convert returns DocField', () => {
    expectTypeOf(fn.convert({ input: d, to: s })).toEqualTypeOf<TypedAggExpr<DocField>>();
  });
  it('convert accepts NumericField for to', () => {
    expectTypeOf(fn.convert({ input: d, to: n })).toEqualTypeOf<TypedAggExpr<DocField>>();
  });
  it('toInt returns NumericField', () => {
    expectTypeOf(fn.toInt(d)).toEqualTypeOf<TypedAggExpr<NumericField>>();
  });
  it('toLong returns NumericField', () => {
    expectTypeOf(fn.toLong(d)).toEqualTypeOf<TypedAggExpr<NumericField>>();
  });
  it('toDouble returns NumericField', () => {
    expectTypeOf(fn.toDouble(d)).toEqualTypeOf<TypedAggExpr<NumericField>>();
  });
  it('toDecimal returns NumericField', () => {
    expectTypeOf(fn.toDecimal(d)).toEqualTypeOf<TypedAggExpr<NumericField>>();
  });
  it('toString_ returns StringField', () => {
    expectTypeOf(fn.toString_(d)).toEqualTypeOf<TypedAggExpr<StringField>>();
  });
  it('toObjectId returns DocField', () => {
    expectTypeOf(fn.toObjectId(d)).toEqualTypeOf<TypedAggExpr<DocField>>();
  });
  it('toBool returns BooleanField', () => {
    expectTypeOf(fn.toBool(d)).toEqualTypeOf<TypedAggExpr<BooleanField>>();
  });
  it('toDate returns DateField', () => {
    expectTypeOf(fn.toDate(d)).toEqualTypeOf<TypedAggExpr<DateField>>();
  });

  it('rejects wrong type for convert to key', () => {
    // @ts-expect-error — to requires StringField | NumericField, not DateField
    fn.convert({ input: d, to: dt });
  });
});

describe('object helpers', () => {
  it('objectToArray returns ArrayField', () => {
    expectTypeOf(fn.objectToArray(d)).toEqualTypeOf<TypedAggExpr<ArrayField>>();
  });
  it('arrayToObject returns DocField', () => {
    expectTypeOf(fn.arrayToObject(d)).toEqualTypeOf<TypedAggExpr<DocField>>();
  });
  it('getField returns DocField', () => {
    expectTypeOf(fn.getField({ field: s, input: d })).toEqualTypeOf<TypedAggExpr<DocField>>();
  });
  it('getField accepts optional input', () => {
    expectTypeOf(fn.getField({ field: s })).toEqualTypeOf<TypedAggExpr<DocField>>();
  });
  it('setField returns DocField', () => {
    expectTypeOf(fn.setField({ field: s, input: d, value: d })).toEqualTypeOf<
      TypedAggExpr<DocField>
    >();
  });

  it('rejects wrong type for getField field key', () => {
    // @ts-expect-error — field requires StringField, not NumericField
    fn.getField({ field: n });
  });
  it('rejects wrong type for setField field key', () => {
    // @ts-expect-error — field requires StringField, not BooleanField
    fn.setField({ field: b, input: d, value: d });
  });
});

describe('literal type inference', () => {
  it('infers StringField from string value', () => {
    expectTypeOf(fn.literal('hello')).toEqualTypeOf<TypedAggExpr<StringField>>();
  });
  it('infers NumericField from number value', () => {
    expectTypeOf(fn.literal(42)).toEqualTypeOf<TypedAggExpr<NumericField>>();
  });
  it('infers BooleanField from boolean value', () => {
    expectTypeOf(fn.literal(true)).toEqualTypeOf<TypedAggExpr<BooleanField>>();
  });
  it('infers DateField from Date value', () => {
    expectTypeOf(fn.literal(new Date())).toEqualTypeOf<TypedAggExpr<DateField>>();
  });

  it('contextual inference constrains value — string literal in StringField position', () => {
    expectTypeOf(fn.dateToString({ date: dt, format: fn.literal('%Y-%m-%d') })).toEqualTypeOf<
      TypedAggExpr<StringField>
    >();
  });

  it('rejects wrong value type in contextual position', () => {
    // @ts-expect-error — format expects StringField, but 42 infers NumericField
    fn.dateToString({ date: dt, format: fn.literal(42) });
  });

  it('allows explicit generic for custom field types', () => {
    type CustomField = { readonly codecId: 'custom/bigint@1'; readonly nullable: false };
    const custom = fn.literal<CustomField>(42n);
    expectTypeOf(custom).toEqualTypeOf<TypedAggExpr<CustomField>>();
  });
});
