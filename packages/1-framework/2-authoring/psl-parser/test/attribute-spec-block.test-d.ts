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
  expectTypeOf(str()).toMatchTypeOf<ArgType<string, AttributeCtx>>();
  expectTypeOf(list(str())).toMatchTypeOf<ArgType<string[], AttributeCtx>>();
  expectTypeOf(funcCall('now', {})).toMatchTypeOf<ArgType<TypedFuncCall, AttributeCtx>>();
});

test('a bare-ctx combinator is usable at all three levels', () => {
  blockAttribute('map', { positional: [{ key: 'name', type: str() }] });
  modelAttribute('map', { positional: [{ key: 'name', type: str() }] });
  fieldAttribute('map', { positional: [{ key: 'name', type: str() }] });
  blockAttribute('now', { named: { at: funcCall('now', {}) } });
});

test('fieldRef and referencedFieldRef expose distinct context metadata', () => {
  const localField = fieldRef();
  const referencedField = referencedFieldRef();

  expectTypeOf(localField).toMatchTypeOf<ArgType<string, ModelAttributeCtx>>();
  expectTypeOf(localField.kind).toEqualTypeOf<'fieldRef'>();
  expectTypeOf(referencedField).toMatchTypeOf<ArgType<string, FieldAttributeCtx>>();
  expectTypeOf(referencedField.kind).toEqualTypeOf<'referencedFieldRef'>();
});

test('a block spec is accepted where a bare-ctx spec is expected', () => {
  const blockSpec = blockAttribute('map', { positional: [{ key: 'name', type: str() }] });
  expectTypeOf(blockSpec).toMatchTypeOf<AttributeSpec<{ name: string }, AttributeCtx>>();
});

test('model and field factories preserve their level-specific contexts', () => {
  const modelSpec = modelAttribute('map', {
    positional: [{ key: 'field', type: fieldRef() }],
  });
  const fieldSpec = fieldAttribute('map', { positional: [{ key: 'name', type: str() }] });

  expectTypeOf(modelSpec).toMatchTypeOf<AttributeSpec<{ field: string }, ModelAttributeCtx>>();
  expectTypeOf(fieldSpec).toMatchTypeOf<AttributeSpec<{ name: string }, FieldAttributeCtx>>();
});

test('oneOf over bare-ctx alternatives stays usable in a block spec', () => {
  const spec = blockAttribute('kind', {
    positional: [{ key: 'kind', type: oneOf(str('a'), str('b')) }],
  });
  expectTypeOf<InferAttr<typeof spec>>().toEqualTypeOf<{ kind: 'a' | 'b' }>();
});

test('oneOf takes its ctx from the annotation a mixed alternation is assigned to', () => {
  const arm: ArgType<string, ModelAttributeCtx> = oneOf(str(), fieldRef());
  expectTypeOf(arm).toMatchTypeOf<ArgType<string, ModelAttributeCtx>>();
  const modelSpec = modelAttribute('ok', { positional: [{ key: 'value', type: arm }] });
  expectTypeOf<InferAttr<typeof modelSpec>>().toEqualTypeOf<{ value: string }>();
});

test('a nullary factory over a block spec satisfies BlockAttributeSpecFactory', () => {
  const factory = () => blockAttribute('map', { positional: [{ key: 'name', type: str() }] });
  expectTypeOf(factory).toMatchTypeOf<BlockAttributeSpecFactory>();
  const modelFactory = () =>
    modelAttribute('map', { positional: [{ key: 'field', type: fieldRef() }] });
  expectTypeOf(modelFactory).toMatchTypeOf<
    () => AttributeSpec<{ field: string }, ModelAttributeCtx>
  >();
});
