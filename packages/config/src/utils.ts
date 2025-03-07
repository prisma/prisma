/**
 * Simplifies the type signature of a type.
 * Re-exported from `effect/Types`.
 *
 * @example
 * ```ts
 * type Res = Simplify<{ a: number } & { b: number }> // { a: number; b: number; }
 * ```
 */
export type Simplify<A> = {
  [K in keyof A]: A[K]
} extends infer B
  ? B
  : never
