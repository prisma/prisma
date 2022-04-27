/* eslint-disable @typescript-eslint/no-unsafe-argument */

import type { A } from 'ts-toolbelt'

import { reduce } from './reduce'

/**
 * Builds a {@link Record} like TS does.
 * @param keys
 * @param values
 * @returns
 */
function record<K extends A.Key, V>(keys: K[], values: V[]): Record<K, V> {
  return reduce(keys, (acc, key, pos) => ({ ...acc, [key]: values[pos] }), {} as Record<K, V>)
}

// TODO improve types as values might not be the same length

export { record }
