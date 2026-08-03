import type { PslDiagnostic } from '@internal/framework-components/psl-ast';
import { ok, type Result } from '@internal/utils/result';
import { expectTypeOf, test } from 'vitest';
import type { ArgType, InferAttr } from '../src/exports';
import { fieldAttribute, modelAttribute, optional } from '../src/exports';

function leaf<T>(kind: string, value: T): ArgType<T> {
  return {
    kind,
    label: kind,
    parse: (): Result<T, readonly PslDiagnostic[]> => ok(value),
  };
}

const str = (): ArgType<string> => leaf('str', '');
const int = (): ArgType<number> => leaf('int', 0);

test('a required named param becomes a required property', () => {
  const spec = fieldAttribute('demo', { named: { name: str() } });
  expectTypeOf<InferAttr<typeof spec>>().toEqualTypeOf<{ readonly name: string }>();
});

test('an optional named param becomes an optional property', () => {
  const spec = fieldAttribute('demo', { named: { name: optional(str()) } });
  expectTypeOf<InferAttr<typeof spec>>().toEqualTypeOf<{ readonly name?: string }>();
});

test('mixed required and optional named params keep their modifiers', () => {
  const spec = fieldAttribute('demo', {
    named: { name: str(), count: optional(int()) },
  });
  expectTypeOf<InferAttr<typeof spec>>().toEqualTypeOf<{
    readonly name: string;
    readonly count?: number;
  }>();
});

test('a positional slot contributes its key into the same keyspace', () => {
  const spec = fieldAttribute('demo', {
    positional: [{ key: 'name', type: str() }],
  });
  expectTypeOf<InferAttr<typeof spec>>().toEqualTypeOf<{ name: string }>();
});

test('an optional positional slot contributes an optional property', () => {
  const spec = fieldAttribute('demo', {
    positional: [{ key: 'name', type: optional(str()) }],
  });
  expectTypeOf<InferAttr<typeof spec>>().toEqualTypeOf<{ name?: string }>();
});

test('a positional-or-named alias collapses to one property', () => {
  const spec = fieldAttribute('demo', {
    positional: [{ key: 'name', type: optional(str()) }],
    named: { name: optional(str()), map: optional(str()) },
  });
  expectTypeOf<InferAttr<typeof spec>>().toEqualTypeOf<{
    name?: string;
    readonly map?: string;
  }>();
});

test('a spec carrying a refine still infers its output', () => {
  const spec = fieldAttribute('demo', {
    named: { name: optional(str()) },
    refine: (parsed) => {
      void parsed.name;
      return [];
    },
  });
  expectTypeOf<InferAttr<typeof spec>>().toEqualTypeOf<{ readonly name?: string }>();
});

test('modelAttribute infers the same shape fieldAttribute would for equivalent params', () => {
  const fieldSpec = fieldAttribute('demo', {
    positional: [{ key: 'name', type: str() }],
    named: { count: optional(int()) },
  });
  const modelSpec = modelAttribute('demo', {
    positional: [{ key: 'name', type: str() }],
    named: { count: optional(int()) },
  });
  expectTypeOf<InferAttr<typeof modelSpec>>().toEqualTypeOf<InferAttr<typeof fieldSpec>>();
  expectTypeOf<InferAttr<typeof modelSpec>>().toEqualTypeOf<{
    name: string;
    readonly count?: number;
  }>();
});

test('a model positional slot contributes its key into the keyspace', () => {
  const spec = modelAttribute('demo', {
    positional: [{ key: 'k', type: int() }],
  });
  expectTypeOf<InferAttr<typeof spec>>().toEqualTypeOf<{ k: number }>();
});
