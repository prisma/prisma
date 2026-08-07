import { expectTypeOf, test } from 'vitest';
import type { Exact } from '../src/type-atoms';

interface UserSelect {
  id: boolean;
  name?: boolean;
}

test('Exact enforces excess property checking on object literals with invalid properties', () => {
  type Valid = Exact<{ id: true }, UserSelect>;
  type Invalid = Exact<{ id: true; created_at: true }, UserSelect>;

  expectTypeOf<Valid>().toEqualTypeOf<{ id: true }>();
  expectTypeOf<Invalid>().toEqualTypeOf<{ id: true; created_at: never }>();
});
