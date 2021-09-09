import type { L } from 'ts-toolbelt'

export type Reducer<I, R> = (
  acc: R,
  item: I,
  pos: number,
  exit: (acc: R) => R,
) => R

const reduce = <L extends L.List, I, R>(
  list: L & L.List<I>,
  reducer: Reducer<I, R>,
  reduced: R,
) => {
  let exited = false

  const exit = (acc: R) => {
    exited = true

    return acc
  }

  for (let pos = 0, len = list.length; pos < len; ++pos) {
    reduced = reducer(reduced, list[pos], pos, exit)

    if (exited) return reduced
  }

  return reduced
}

export { reduce }
