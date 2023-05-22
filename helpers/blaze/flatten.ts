/* eslint-disable @typescript-eslint/no-unsafe-argument */

import type { L } from 'ts-toolbelt'

import { concat } from './concat'
import { reduce } from './reduce'

function wrap(item: unknown) {
  return Array.isArray(item) ? item : [item]
}

/**
 * Returns a new array with all sub-array elements concatenated.
 * (more efficient than native flat)
 *
 * @param list
 * @returns
 */
function flatten<T extends L.List, I>(list: T & L.List<I>): Flatten<T> {
  return reduce(list, (acc, item) => concat(acc, wrap(item)), [] as any[])
}

type Flatten<L extends L.List, I = L[number]> = (I extends L.List ? I[number] : I)[]

export { flatten }
