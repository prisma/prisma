/* eslint-disable @typescript-eslint/no-unsafe-argument */

import type { L } from 'ts-toolbelt'

export type Reducer<I, R> = (acc: R, item: I, pos: number, exit: (acc: R) => R) => R

/**
 * Calls the specified callback function for all the elements in an array. The
 * return value of the callback function is the accumulated result, and is
 * provided as an argument in the next call to the callback function.
 *
 * (more efficient than native reduce)
 *
 * @param list to accumulate
 * @param reducer to callback
 * @param acc initial value
 * @returns
 */
const reduce = <I, R>(list: L.List<I>, reducer: Reducer<I, R>, acc: R) => {
  let hasExit = false

  const exit = (acc: R) => {
    hasExit = true

    return acc
  }

  for (let i = 0; !hasExit && i < list.length; ++i) {
    acc = reducer(acc, list[i], i, exit)
  }

  return acc
}

export { reduce }
