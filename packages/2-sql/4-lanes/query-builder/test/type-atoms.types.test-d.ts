import { expectTypeOf, test } from 'vitest';
import type { Exact } from '../src/type-atoms';

interface UserSelect {
  id?: boolean;
  name?: boolean;
}

interface UserFindArgs<T extends object = UserSelect> {
  select?: Exact<T, UserSelect>;
}

declare function findFirst<T extends object>(args?: UserFindArgs<T>): Promise<T>;
declare function findUnique<T extends object>(args?: UserFindArgs<T>): Promise<T>;
declare function findMany<T extends object>(args?: UserFindArgs<T>): Promise<T>;

test('Exact enforces excess property checking on object literals with invalid properties', () => {
  type Valid = Exact<{ id: true }, UserSelect>;
  type Invalid = Exact<{ id: true; created_at: true }, UserSelect>;

  expectTypeOf<Valid>().toEqualTypeOf<{ id: true }>();
  expectTypeOf<Invalid>().toEqualTypeOf<{ id: true; created_at: never }>();
});

test('satisfies-based select verifies valid selections and rejects excess properties', () => {
  const validSelect = {
    id: true,
  } satisfies UserSelect;
  expectTypeOf(validSelect).toMatchTypeOf<UserSelect>();

  // @ts-expect-error excess property 'created_at' does not exist in UserSelect
  const _invalidSelect = {
    id: true,
    created_at: true,
  } satisfies UserSelect;
});

test('query-builder call sites (findFirst, findUnique, findMany) enforce Exact select type coverage', () => {
  type ValidQuery = Exact<{ id: true }, UserSelect>;
  type InvalidQuery = Exact<{ id: true; created_at: true }, UserSelect>;

  expectTypeOf<ValidQuery>().toEqualTypeOf<{ id: true }>();
  expectTypeOf<InvalidQuery['created_at']>().toEqualTypeOf<never>();

  expectTypeOf<UserFindArgs<{ id: true }>>().not.toBeNever();
});
