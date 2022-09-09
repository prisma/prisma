/* eslint-disable @typescript-eslint/no-unsafe-argument */

import type { L } from 'ts-toolbelt'

import { flatten } from './flatten'
import { map } from './map'
import { repeat, times } from './repeat'
import { select } from './select'
import type { Strict } from './utils/types/Strict'

/**
 * Recursive function that is able to create a matrix of lists.
 * The algorithm is quite simple and recursively applies a map.
 * @example
 * map(lists[0], (item0) => map(lists[1], (item1) => map(lists[2], (...) => [item0, item1, ...])))
 */
function _matrix<I>(lists: L.List<L.List<I>>, items: L.List<I> = []) {
  if (items.length === lists.length) return items

  return map(lists[items.length], (item) => _matrix(lists, [...items, item]))
}

/**
 * Creates the cross-product of a list of lists.
 *
 * @param lists
 * @returns
 */
function matrix<I extends L.List>(lists: L.List<I>): Strict<I[number]>[][] {
  // we cannot produce a matrix with empty lists, filter them out
  const nonEmptyLists = select(lists, (list) => list.length > 0)
  const nonFlatMatrix = _matrix(nonEmptyLists) // first raw matrix
  const flattenMatrix = repeat(flatten, times(nonEmptyLists.length - 1))

  // we flatten the matrix as many times as it had recursion levels
  return flattenMatrix(nonFlatMatrix) // final flat matrix
}

export { matrix }
