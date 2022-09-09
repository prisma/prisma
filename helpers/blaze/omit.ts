/* eslint-disable @typescript-eslint/no-unsafe-argument */

import type { A, L, O } from 'ts-toolbelt'

import { reduce } from './reduce'
import { select } from './select'

type KeyMap = { [key: A.Key]: boolean }

function omitList<L extends L.List, K extends A.Key>(object: L, keys: K[]) {
  const _keys = reduce(keys, (acc, key) => (acc[key] = true) && acc, {} as KeyMap)

  return select(object, (item, key) => !(key in _keys))
}

function omitObject<O extends O.Object, K extends A.Key>(object: O, keys: K[]) {
  const _keys = reduce(keys, (acc, key) => (acc[key] = true) && acc, {} as KeyMap)

  return select(object, (item, key) => !(key in _keys))
}

/**
 * Omit a subset of entries of an object or list.
 *
 * @param object to be picked
 * @param keys to pick
 * @returns
 */
const omit: typeof omitList & typeof omitObject = ((object: any, keys: any) => {
  return Array.isArray(object) ? omitList(object, keys) : omitObject(object, keys)
}) as any

export { omit }
