import type { L } from 'ts-toolbelt'

export type Reducer<I, R> = (acc: R, item: I, pos: number, exit: (acc: R) => R) => R

/**
 * Calls the specified callback function for all the elements in an array. The
 * return value of the callback function is the accumulated result, and is
 * provided as an argument in the next call to the callback function.
 *
 * (more efficient than native reduce)
 * @param list to accumulate
 * @param reducer to callback
 * @param acc initial value
 * @returns
 */
const reduce = <L extends L.List<I>, I, R>(list: L & L.List<I>, reducer: Reducer<I, R>, acc: R) => {
  let exited = false

  const exit = (acc: R) => {
    exited = true

    return acc
  }

  for (let i = 0; !exited && i < list.length; ++i) {
    acc = reducer(acc, list[i], i, exit)
  }

  return acc
}

export { reduce }
