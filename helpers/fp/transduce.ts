import type { L } from 'ts-toolbelt'
import { _ } from './_'
import { reduce } from './reduce'
import { pipe } from './pipe'

const skip = Symbol('skip')

/**
 * Transducers enable efficient data processing. They allow the composition of
 * mappers and filters to be applied on a list. And this is applied in a single
 * pass, that's the efficient pipeline processing.
 *
 * @see https://medium.com/javascript-scene/7985330fe73d
 *
 * @param list to transform
 * @param transformer to apply
 * @returns
 * @example
 * ```ts
 * const filterEven = Filter(<U>(unit: U) =>
 *   typeof unit === 'number' ? !(unit % 2) : true,
 * )
 * const mapTimes2 = Mapper(<U>(unit: U) =>
 *   typeof unit === 'number' ? unit * 2 : `${unit}`,
 * )
 * const mapString = Mapper(<U>(unit: U) => `${unit}`)
 *
 * const test0 = transduce(
 *   [1, 2, 3, 4, 5, 6, 7, 'a'],
 *   pipe(filterEven, mapTimes2, mapTimes2, mapString, filterEven),
 * )
 * ```
 */
const transduce = <L extends L.List, I, R>(
  list: L & L.List<I>,
  transformer: (item: I) => R | typeof skip,
) => {
  return reduce(
    list,
    (acc, unit) => {
      const transformed = transformer(unit)

      if (transformed === skip) return acc

      acc[acc.length] = transformed

      return acc
    },
    [] as R[],
  )
}

const Filter =
  <I>(filter: (item: I) => boolean) =>
  (item: I) => {
    return filter(item) ? item : (skip as never)
  }

const Mapper =
  <I, R>(mapper: (item: I) => R) =>
  (item: I) => {
    return mapper(item)
  }

export { transduce, Filter, Mapper, skip }

const filterEven = Filter(<U extends number>(unit: U) =>
  typeof unit === 'number' ? !(unit % 2) : true,
)
const mapTimes2 = Mapper(<U extends number>(unit: U) =>
  typeof unit === 'number' ? unit * 2 : unit,
)
const mapString = Mapper(<U>(unit: U) => `${unit}`)
const test0 = transduce(
  [1, 2, 3, 4, 5, 6, 7, 'a'],
  pipe(filterEven, mapTimes2, mapTimes2, filterEven),
)
