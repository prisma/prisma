import { ok } from '@internal/utils/result';
import { expectTypeOf, test } from 'vitest';
import type {
  ArgType,
  AttributeCtx,
  FieldAttributeCtx,
  ModelAttributeCtx,
  OutOf,
  TypedFuncCall,
} from '../src/exports';
import {
  blockAttribute,
  bool,
  entityRef,
  fieldAttribute,
  fieldRef,
  funcCall,
  identifier,
  int,
  list,
  modelAttribute,
  num,
  oneOf,
  optional,
  record,
  referencedFieldRef,
  str,
} from '../src/exports';

test('identifier pins its name as the output literal type', () => {
  const action = identifier('NoAction');

  expectTypeOf<OutOf<typeof action>>().toEqualTypeOf<'NoAction'>();
  expectTypeOf(action.name).toEqualTypeOf<'NoAction'>();
});

test('oneOf infers the union of its alternatives output types', () => {
  const action = oneOf(identifier('NoAction'), identifier('Cascade'));

  expectTypeOf<OutOf<typeof action>>().toEqualTypeOf<'NoAction' | 'Cascade'>();
  expectTypeOf(action.alternatives[0].name).toEqualTypeOf<'NoAction'>();
  expectTypeOf(action.alternatives[1].name).toEqualTypeOf<'Cascade'>();
});

test('pinned str preserves its output literal type', () => {
  const pinned = str('hashed');

  expectTypeOf<OutOf<typeof pinned>>().toEqualTypeOf<'hashed'>();
});

test('pinned num preserves its output literal type', () => {
  const pinned = num(-1);

  expectTypeOf<OutOf<typeof pinned>>().toEqualTypeOf<-1>();
});

test('oneOf preserves pinned string and number literal alternatives', () => {
  const pinned = oneOf(str('hashed'), str('2dsphere'), num(-1));

  expectTypeOf<OutOf<typeof pinned>>().toEqualTypeOf<'hashed' | '2dsphere' | -1>();
});

test('oneOf with no alternatives is a compile error', () => {
  // @ts-expect-error oneOf requires at least one alternative
  oneOf();
});

test('oneOf preserves every alternative context requirement', () => {
  const bareThenModel = oneOf(str(), fieldRef());
  const modelThenBare = oneOf(fieldRef(), str());
  const bareThenField = oneOf(str(), referencedFieldRef());
  const fieldThenBare = oneOf(referencedFieldRef(), str());
  const modelThenField = oneOf(fieldRef(), referencedFieldRef());
  const fieldThenModel = oneOf(referencedFieldRef(), fieldRef());

  expectTypeOf(bareThenModel.requiredContext).toEqualTypeOf<'model'>();
  expectTypeOf(modelThenBare.requiredContext).toEqualTypeOf<'model'>();
  expectTypeOf(bareThenField.requiredContext).toEqualTypeOf<'field'>();
  expectTypeOf(fieldThenBare.requiredContext).toEqualTypeOf<'field'>();
  expectTypeOf(modelThenField.requiredContext).toEqualTypeOf<'field'>();
  expectTypeOf(fieldThenModel.requiredContext).toEqualTypeOf<'field'>();

  expectTypeOf<typeof bareThenModel>().toExtend<ArgType<string, ModelAttributeCtx>>();
  expectTypeOf<typeof modelThenBare>().toExtend<ArgType<string, ModelAttributeCtx>>();
  expectTypeOf<typeof bareThenField>().toExtend<ArgType<string, FieldAttributeCtx>>();
  expectTypeOf<typeof fieldThenBare>().toExtend<ArgType<string, FieldAttributeCtx>>();
  expectTypeOf<typeof modelThenField>().toExtend<ArgType<string, FieldAttributeCtx>>();
  expectTypeOf<typeof fieldThenModel>().toExtend<ArgType<string, FieldAttributeCtx>>();

  modelAttribute('modelOnly', { positional: [{ key: 'value', type: bareThenModel }] });
  fieldAttribute('fieldOnly', { positional: [{ key: 'value', type: bareThenField }] });
  fieldAttribute('fieldOnly', { positional: [{ key: 'value', type: modelThenField }] });

  // @ts-expect-error model-requiring alternatives cannot enter block attribute specs
  blockAttribute('invalid', { positional: [{ key: 'value', type: bareThenModel }] });
  // @ts-expect-error field-requiring alternatives cannot enter block attribute specs
  blockAttribute('invalid', { positional: [{ key: 'value', type: bareThenField }] });
  // @ts-expect-error field-requiring alternatives cannot enter model attribute specs
  modelAttribute('invalid', { positional: [{ key: 'value', type: modelThenField }] });
});

test('oneOf context requirements survive optional and nested wrappers', () => {
  const optionalModelAlternative = optional(oneOf(str(), fieldRef()));
  const modelAlternativeList = list(oneOf(str(), fieldRef()));
  const fieldAlternativeRecord = record(optional(oneOf(fieldRef(), referencedFieldRef())));

  expectTypeOf(optionalModelAlternative.requiredContext).toEqualTypeOf<'model'>();
  expectTypeOf(modelAlternativeList.requiredContext).toEqualTypeOf<'model'>();
  expectTypeOf(fieldAlternativeRecord.requiredContext).toEqualTypeOf<'field'>();
  expectTypeOf<typeof optionalModelAlternative>().toExtend<ArgType<string, ModelAttributeCtx>>();
  expectTypeOf<typeof modelAlternativeList>().toExtend<ArgType<string[], ModelAttributeCtx>>();
  expectTypeOf<typeof fieldAlternativeRecord>().toExtend<
    ArgType<Record<string, string>, FieldAttributeCtx>
  >();

  // @ts-expect-error nested model-requiring alternatives cannot enter block attribute specs
  blockAttribute('invalid', { positional: [{ key: 'value', type: optionalModelAlternative }] });
  // @ts-expect-error nested field-requiring alternatives cannot enter model attribute specs
  modelAttribute('invalid', { positional: [{ key: 'value', type: fieldAlternativeRecord }] });
});

test('list infers an array of its element type', () => {
  const values = list(str());

  expectTypeOf<OutOf<typeof values>>().toEqualTypeOf<string[]>();
});

test('combinators narrow by kind to inspectable metadata', () => {
  const arg = oneOf(str('hashed'), num(-1), list(identifier('Cascade')));

  if (arg.kind === 'oneOf') {
    expectTypeOf<OutOf<(typeof arg.alternatives)[number]>>().toEqualTypeOf<
      'hashed' | -1 | 'Cascade'[]
    >();
    const first = arg.alternatives[0];
    if (first.kind === 'str') {
      expectTypeOf(first.value).toEqualTypeOf<'hashed'>();
    }
    const third = arg.alternatives[2];
    if (third.kind === 'list') {
      expectTypeOf<OutOf<typeof third.of>>().toEqualTypeOf<'Cascade'>();
    }
  }
});

test('fixed and unrestricted scalar metadata stay distinguishable', () => {
  const unrestrictedString = str();
  const fixedString = str('upper');
  const unrestrictedNumber = num();
  const fixedNumber = num(5);

  if (unrestrictedString.kind === 'str') {
    expectTypeOf(unrestrictedString.value).toEqualTypeOf<undefined>();
  }
  if (fixedString.kind === 'str') {
    expectTypeOf(fixedString.value).toEqualTypeOf<'upper'>();
  }
  if (unrestrictedNumber.kind === 'num') {
    expectTypeOf(unrestrictedNumber.value).toEqualTypeOf<undefined>();
  }
  if (fixedNumber.kind === 'num') {
    expectTypeOf(fixedNumber.value).toEqualTypeOf<5>();
  }
});

test('child and signature metadata preserve output and context types', () => {
  const fields = list(fieldRef(), { nonEmpty: true, unique: true });
  const namedRecord = record(int({ min: 1, max: 9 }));
  const call = funcCall('nanoid', {
    positional: [{ key: 'size', type: optional(int({ min: 2 })) }],
    named: { prefix: optional(str('usr')) },
  });

  if (fields.kind === 'list') {
    expectTypeOf<OutOf<typeof fields.of>>().toEqualTypeOf<string>();
    expectTypeOf(fields.of).toMatchTypeOf<ArgType<string, ModelAttributeCtx>>();
    expectTypeOf(fields.nonEmpty).toEqualTypeOf<true>();
    expectTypeOf(fields.unique).toEqualTypeOf<true>();
  }
  if (namedRecord.kind === 'record') {
    expectTypeOf<OutOf<typeof namedRecord.of>>().toEqualTypeOf<number>();
  }
  if (call.kind === 'funcCall') {
    expectTypeOf(call.name).toEqualTypeOf<'nanoid'>();
    expectTypeOf<
      OutOf<NonNullable<typeof call.signature.positional>[0]['type']>
    >().toEqualTypeOf<number>();
    expectTypeOf<
      OutOf<NonNullable<typeof call.signature.named>['prefix']>
    >().toEqualTypeOf<'usr'>();
    expectTypeOf<OutOf<typeof call>>().toEqualTypeOf<TypedFuncCall>();
  }
});

test('optional wrappers retain child metadata and optional markers', () => {
  const optionalList = optional(list(str('tag'), { nonEmpty: true }), ['tag']);

  expectTypeOf<OutOf<typeof optionalList>>().toEqualTypeOf<'tag'[]>();
  if (optionalList.kind === 'list') {
    expectTypeOf(optionalList.optional).toEqualTypeOf<true>();
    expectTypeOf(optionalList.hasDefault).toEqualTypeOf<true>();
    expectTypeOf(optionalList.defaultValue).toEqualTypeOf<'tag'[] | undefined>();
    expectTypeOf<OutOf<typeof optionalList.of>>().toEqualTypeOf<'tag'>();
    expectTypeOf(optionalList.nonEmpty).toEqualTypeOf<true>();
  }
});

test('field references have distinct inspectable kinds', () => {
  expectTypeOf(fieldRef().kind).toEqualTypeOf<'fieldRef'>();
  expectTypeOf(referencedFieldRef().kind).toEqualTypeOf<'referencedFieldRef'>();
  expectTypeOf(entityRef().kind).toEqualTypeOf<'entityRef'>();
});

test('arbitrary combinator kinds are rejected', () => {
  const fake: ArgType<string, AttributeCtx> = {
    // @ts-expect-error ArgType is closed to framework-defined combinator kinds
    kind: 'custom',
    label: 'custom',
    parse: () => ok('custom'),
  };
  void fake;
});

test('primitive constructors expose central kind literals', () => {
  expectTypeOf(bool().kind).toEqualTypeOf<'bool'>();
  expectTypeOf(int().kind).toEqualTypeOf<'int'>();
});
