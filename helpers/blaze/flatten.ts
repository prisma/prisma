import { L } from 'ts-toolbelt'
import { reduce } from './reduce'
import { concat } from './concat'

function wrap(item: unknown) {
  return Array.isArray(item) ? item : [item]
}

// eslint-disable-next-line prettier/prettier
type Flatten<L extends L.List, I = L[number]> =
  (I extends L.List ? I[number] : I)[] & {}

/**
 * Returns a new array with all sub-array elements concatenated.
 *
 * (more efficient than native flat)
 * @param list
 * @returns
 */
function flatten<L extends L.List, I>(list: L & L.List<I>): Flatten<L> {
  return reduce(list, (acc, item) => concat(acc, wrap(item)), [] as any[])
}

export { flatten }
