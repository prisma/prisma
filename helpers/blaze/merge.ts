/* eslint-disable @typescript-eslint/no-unsafe-argument */

import type { L, U } from 'ts-toolbelt'

import { reduce } from './reduce'

function merge<O extends object>(objects: L.List<O>): U.Merge<O> {
  return reduce(objects, (acc, object) => ({ ...acc, ...object }), {} as U.Merge<O>)
}

// TODO: check perf diff between reduce and for loop

export { merge }
