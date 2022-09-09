/* eslint-disable @typescript-eslint/no-unsafe-argument */

import type { L } from 'ts-toolbelt'

const skip = Symbol('skip')

type SyncTransformer<I, R> = (item: I, key: number) => R | typeof skip
type ASyncTransformer<I, R> = (item: I, key: number) => Promise<R | typeof skip>

function transduceSync<I, R>(list: L.List<I>, transformer: SyncTransformer<I, R>) {
  const transduced = [] as R[]

  for (let i = 0; i < list.length; ++i) {
    const transformed = transformer(list[i], i)

    if (transformed !== skip) {
      transduced[transduced.length] = transformed
    }
  }

  return transduced
}

async function transduceAsync<I, R>(list: L.List<I>, transformer: ASyncTransformer<I, R>) {
  const transduced = [] as R[]

  for (let i = 0; i < list.length; ++i) {
    const transformed = await transformer(list[i], i)

    if (transformed !== skip) {
      transduced[transduced.length] = transformed
    }
  }

  return transduced
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

/**
 * Transducers enable efficient data processing. They allow the composition of
 * mappers and filters to be applied on a list. And this is applied in a single
 * pass, that's the efficient pipeline processing.
 *
 * (does not reduce at the same time)
 *
 * @see https://medium.com/javascript-scene/7985330fe73d
 * @param list to transform
 * @param transformer to apply
 * @returns
 * @example
 * ```ts
 * const filterEven = Filter(<U>(unit: U) =>
 *   typeof unit === 'number' ? !(unit % 2) : true,
 * )
 * const mapTimes2 = Mapper(<U>(unit: U) =>
 *   typeof unit === 'number' ? unit * 2 : unit,
 * )
 * const mapString = Mapper(<U>(unit: U) => `${unit}`)
 *
 * const test0 = transduce(
 *   [1, 2, 3, 4, 5, 6, 7, 'a'],
 *   pipe(filterEven, mapTimes2, mapTimes2, mapString, filterEven),
 * )
 * ```
 */
const transduce = transduceSync as typeof transduceSync & {
  async: typeof transduceAsync
}

transduce.async = transduceAsync

export { Filter, Mapper, skip, transduce }
