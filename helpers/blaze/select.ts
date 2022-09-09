/* eslint-disable @typescript-eslint/no-unsafe-argument */

import type { L, O } from 'ts-toolbelt'

export type LPred<I> = (item: I, pos: number) => boolean
export type OPred<I> = (item: I, key: string) => boolean

function selectList<L extends L.List, I>(object: L & L.List<I>, pred: LPred<I>): L[number][] {
  const selected = [] as any[]

  for (let i = 0; i < object.length; ++i) {
    if (pred(object[i], i)) {
      selected.push(object[i])
    }
  }

  return selected
}

function selectObject<O extends O.Object, I>(object: O, pred: OPred<I>): O.Optional<O> {
  const selected = {} as any

  const keys = Object.keys(object)
  for (let i = 0; i < keys.length; ++i) {
    if (pred(object[i], keys[i])) {
      selected[keys[i]] = object[keys[i]]
    }
  }

  return selected
}

/**
 * Select the subset that matches the predicate.
 *
 * @param object to be selected
 * @param pred to select with
 * @returns
 */
const select: typeof selectList & typeof selectObject = ((object: any, pred: any) => {
  return Array.isArray(object) ? selectList(object, pred) : selectObject(object, pred)
}) as any

export { select }
