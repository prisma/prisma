import { Omit } from '../types/Utils'

/*
 * Because we use a symbol to store the context, we need to merge the context
 * with the original this type. We manage the context via `getExtensionContext`
 * to circumvent the limitations of `this` inference in TS, while also providing
 * a unified API for context management in generic and non-generic extensions.
 */

/* eslint-disable prettier/prettier */
export type Context<T> =
  T extends { [K: symbol]: { ctx: infer C } }
  ? Omit<T, keyof C> & C & { meta: { name: string } }
  : Record<string, unknown> & { meta: { name: string } }
/* eslint-enable prettier/prettier */

export function getExtensionContext<T>(that: T) {
  return that as any as Context<T>
}
