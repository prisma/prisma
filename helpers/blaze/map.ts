/* eslint-disable @typescript-eslint/no-unsafe-argument */

import type { A, L, O } from 'ts-toolbelt'

export type LMapper<L, I, R> = (item: I, pos: A.Keys<L>) => R
export type OMapper<O, I, R> = (item: I, key: A.Keys<O>) => R

type Map<A, R> = {
  [K in keyof A]: R
} & {}

function mapList<T extends L.List, I, R>(object: T & L.List<I>, mapper: LMapper<T, I, R>): Map<T, R> {
  const mapped = new Array(object.length)

  for (let i = 0; i < object.length; ++i) {
    mapped[i] = mapper(object[i], i as A.Keys<T>)
  }

  return mapped as any
}

function mapObject<T extends O.Object, I, R>(object: T & O.Record<A.Key, I>, mapper: OMapper<T, I, R>): Map<T, R> {
  const mapped = {} as any

  const keys = Object.keys(object) as A.Keys<T>[]
  for (let i = 0; i < keys.length; ++i) {
    mapped[i] = mapper(object[keys[i]], keys[i])
  }

  return mapped
}

/**
 * Map an object or a list to a new one.
 * (more efficient than native map)
 *
 * @param object to be mapped
 * @param mapper to map with
 * @returns
 */
const map: typeof mapList & typeof mapObject = ((object: any, mapper: any) => {
  return Array.isArray(object) ? mapList(object, mapper) : mapObject(object, mapper)
}) as any

export { map }
