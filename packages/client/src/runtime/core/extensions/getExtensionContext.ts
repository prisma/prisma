import { Omit } from '../types/Utils'

/**
 * Extracts the context that we have stored in a symbol.
 */
type GetSymbolContext<T> = T extends { [K: symbol]: { ctx: any } } ? T[symbol]['ctx'] : unknown

/**
 * Because we use a symbol to store the context, we need to merge the context
 * with the original type. We manage the context via `getExtensionContext` to
 * circumvent the limitations of `this` inference in TS, while also providing a
 * unified API for context management in generic and non-generic extensions.
 */
type GetMergedContext<T, S = GetSymbolContext<T>> = Omit<T, keyof S> & S

export type ExtensionContext<T> = GetMergedContext<T>

export function getExtensionContext<T>(that: T) {
  return that as any as ExtensionContext<T>
}
