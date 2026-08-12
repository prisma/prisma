import { expect } from 'vitest';

/**
 * Compile-time exact equality check that handles branded/literal types correctly.
 * Unlike `expectTypeOf`, this does not erase brands during comparison.
 */
export type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/**
 * Compile-time assertion that T is `true`. Use with {@link Equal} for type-level tests.
 *
 * @example
 * ```typescript
 * type _check = Expect<Equal<Vector<1536>, Vector<1536>>>;
 * ```
 */
export type Expect<T extends true> = T;

export function expectDefined<T>(value: T | undefined): asserts value is T {
  expect(value).toBeDefined();
}

/**
 * Asserts the truthiness of the given value, narrowing its type.
 * Use in tests as a type-narrowing alternative to bare `expect`.
 *
 * @example
 * ```typescript
 * const result = planner.plan(...);
 * expectNarrowedType(result.kind === 'success', 'expected planner success');
 * // result is now narrowed to the success branch
 * ```
 */
export function expectNarrowedType(value: unknown, message?: string): asserts value {
  expect(value, message).toBeTruthy();
}
