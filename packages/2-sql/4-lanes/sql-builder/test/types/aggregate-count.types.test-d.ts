/**
 * Type-test: `count` reads the same rows of the emitted aggregate map the
 * runtime registry resolves through.
 *
 * The map carries three rows per operation: `byCodec` answers an exact input
 * codec, `anyInput` answers an input no row claims, and `withoutInput` answers
 * a call with no input at all. The runtime resolves `count(expr)` through
 * `byCodec[input] ?? anyInput` and `count()` through `withoutInput` — so the
 * typed surface must read the same rows. Both built-in targets declare
 * coinciding rows for count, which is why this map is synthetic: every row
 * answers with a different codec, so a signature reading the wrong row cannot
 * go green here.
 */

import { expectTypeOf, test } from 'vitest';
import type { AggregateOnlyFunctions, Expression, FieldProxy } from '../../src/expression';
import type { Scope } from '../../src/scope';

type CT = {
  'syn/uuid@1': { input: string; output: string };
  'syn/text@1': { input: string; output: string };
};

type QC = {
  codecTypes: CT;
  capabilities: Record<string, Record<string, boolean>>;
  queryOperationTypes: Record<string, never>;
  resolvedColumnOutputTypes: Record<string, never>;
  aggregateTypes: {
    count: {
      byCodec: {
        'syn/uuid@1': { output: 'syn/count-of-uuid@1'; nullable: true };
      };
      withoutInput: { output: 'syn/count-of-rows@1'; nullable: false };
      anyInput: { output: 'syn/count-of-any@1'; nullable: false };
    };
  };
};

type UserColumns = {
  id: { codecId: 'syn/uuid@1'; nullable: false };
  name: { codecId: 'syn/text@1'; nullable: true };
};
type UserScope = Scope & {
  topLevel: UserColumns;
  namespaces: { User: UserColumns };
};

declare const f: FieldProxy<UserScope>;
declare const fns: AggregateOnlyFunctions<QC>;

test('count() reads the withoutInput row', () => {
  expectTypeOf(fns.count()).toEqualTypeOf<
    Expression<{ codecId: 'syn/count-of-rows@1'; nullable: false }>
  >();
});

test('count(expr) reads the byCodec row for a claimed input codec', () => {
  expectTypeOf(fns.count(f.id)).toEqualTypeOf<
    Expression<{ codecId: 'syn/count-of-uuid@1'; nullable: true }>
  >();
});

test('count(expr) reads the anyInput row for an unclaimed input codec', () => {
  expectTypeOf(fns.count(f.name)).toEqualTypeOf<
    Expression<{ codecId: 'syn/count-of-any@1'; nullable: false }>
  >();
});
