/* eslint-disable @typescript-eslint/no-unsafe-argument */

import type { A } from 'ts-toolbelt'

/**
 * Get the keys of something.
 *
 * @param thing
 * @returns
 */
function keys<T>(thing: T) {
  return Object.keys(thing) as `${Exclude<A.Keys<T>, symbol>}`[]
}

export { keys }
