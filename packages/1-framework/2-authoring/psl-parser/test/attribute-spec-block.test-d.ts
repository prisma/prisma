import { expectTypeOf, test } from 'vitest';
import type {
  ArgType,
  AttributeCtx,
  AttributeSpec,
  BlockAttributeSpecFactory,
  FieldAttributeCtx,
  InferAttr,
  ModelAttributeCtx,
  TypedFuncCall,
} from '../src/exports';
import {
  blockAttribute,
  fieldAttribute,
  fieldRef,
  funcCall,
  list,
  modelAttribute,
  oneOf,
  optional,
  referencedFieldRef,
  str,
} from '../src/exports';

test('blockAttribute infers its output like modelAttribute', () => {
  const blockSpec = blockAttribute('map', {
    positional: [{ key: 'name', type: str() }],
    named: { schema: optional(str()) },
  });
  const modelSpec = modelAttribute('map', {
    positional: [{ key: 'name', type: str() }],
    named: { schema: optional(str()) },
  });
  expectTypeOf<InferAttr<typeof blockSpec>>().toEqualTypeOf<InferAttr<typeof modelSpec>>();
  expectTypeOf<InferAttr<typeof blockSpec>>().toEqualTypeOf<{
    name: string;
    readonly schema?: string;
  }>();
});

test('a model-free combinator parses over the bare attribute ctx', () => {
  expectTypeOf(str()).toEqualTypeOf<ArgType<string, AttributeCtx>>();
  expectTypeOf(list(str())).toEqualTypeOf<ArgType<string[], AttributeCtx>>();
  expectTypeOf(funcCall('now', {})).toEqualTypeOf<ArgType<TypedFuncCall, AttributeCtx>>();
});

test('a bare-ctx combinator is usable at all three levels', () => {
  blockAttribute('map', { positional: [{ key: 'name', type: str() }] });
  modelAttribute('map', { positional: [{ key: 'name', type: str() }] });
  fieldAttribute('map', { positional: [{ key: 'name', type: str() }] });
  blockAttribute('now', { named: { at: funcCall('now', {}) } });
});

test('a combinator that reads the model is rejected inside a block spec', () => {
  blockAttribute('bad', {
    // @ts-expect-error fieldRef needs selfModel, which a block never has
    positional: [{ key: 'field', type: fieldRef() }],
  });
  blockAttribute('worse', {
    // @ts-expect-error referencedFieldRef needs the field, which a block never has
    positional: [{ key: 'field', type: referencedFieldRef() }],
  });
});

test('fieldRef is model-scoped and referencedFieldRef is field-scoped', () => {
  modelAttribute('index', { positional: [{ key: 'fields', type: fieldRef() }] });
  fieldAttribute('id', { positional: [{ key: 'field', type: fieldRef() }] });
  fieldAttribute('relation', { named: { references: referencedFieldRef() } });
  modelAttribute('bad', {
    // @ts-expect-error referencedFieldRef resolves through the field, which a model spec never has
    named: { references: referencedFieldRef() },
  });
});

test('a block spec is accepted where a bare-ctx spec is expected', () => {
  const blockSpec = blockAttribute('map', { positional: [{ key: 'name', type: str() }] });
  expectTypeOf(blockSpec).toMatchTypeOf<AttributeSpec<{ name: string }, AttributeCtx>>();
});

test('a model-level spec is rejected where a bare-ctx spec is expected', () => {
  const modelSpec = modelAttribute('map', {
    positional: [{ key: 'field', type: fieldRef() }],
  });
  expectTypeOf(modelSpec).not.toMatchTypeOf<AttributeSpec<{ field: string }, AttributeCtx>>();
});

test('a field-level spec is rejected where a model-level spec is expected', () => {
  const fieldSpec = fieldAttribute('map', { positional: [{ key: 'name', type: str() }] });
  expectTypeOf(fieldSpec).not.toMatchTypeOf<AttributeSpec<{ name: string }, ModelAttributeCtx>>();
  expectTypeOf(fieldSpec).toMatchTypeOf<AttributeSpec<{ name: string }, FieldAttributeCtx>>();
});

test('oneOf over bare-ctx alternatives stays usable in a block spec', () => {
  const spec = blockAttribute('kind', {
    positional: [{ key: 'kind', type: oneOf(str('a'), str('b')) }],
  });
  expectTypeOf<InferAttr<typeof spec>>().toEqualTypeOf<{ kind: 'a' | 'b' }>();
});

test('oneOf carrying a model-scoped alternative is rejected in a block spec', () => {
  const arm = oneOf(str(), fieldRef());
  blockAttribute('bad', {
    // @ts-expect-error one alternative reads selfModel, so the alternation demands a model ctx
    positional: [{ key: 'value', type: arm }],
  });
  const modelSpec = modelAttribute('ok', { positional: [{ key: 'value', type: arm }] });
  expectTypeOf<InferAttr<typeof modelSpec>>().toEqualTypeOf<{ value: string }>();
});

test('a nullary factory over a block spec satisfies BlockAttributeSpecFactory', () => {
  const factory = () => blockAttribute('map', { positional: [{ key: 'name', type: str() }] });
  expectTypeOf(factory).toMatchTypeOf<BlockAttributeSpecFactory>();
  const modelFactory = () =>
    modelAttribute('map', { positional: [{ key: 'field', type: fieldRef() }] });
  expectTypeOf(modelFactory).not.toMatchTypeOf<BlockAttributeSpecFactory>();
});
