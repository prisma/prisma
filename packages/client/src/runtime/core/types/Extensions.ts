/* eslint-disable prettier/prettier */
import { RequiredArgs as Args } from '../extensions/$extends'
import { Omit, ReadonlyDeep } from './Utils'

export type DefaultArgs = { result: {}; model: {}; query: {}; client: {} }

export type GetResult<Base extends object, R extends Args['result'][string]> =
  {} extends R ? Base : { [K in keyof R]: ReturnType<R[K]['compute']> } & { [K in Exclude<keyof Base, keyof R>]: Base[K] }

export type GetSelect<Base extends object, R extends Args['result'][string]> =
  { [K in keyof R | keyof Base]?: K extends keyof Base ? Base[K] : boolean } 

export type GetModel<Base extends object, M extends Args['model'][string]> =
  M & Omit<Base, keyof M>

export type GetClient<Base extends object, C extends Args['client'], CP extends Args['client']> =
  C & Omit<CP, keyof C> & Omit<Base, '$use' | keyof C | keyof CP>

export type ReadonlySelector<T> = T extends unknown ? {
  readonly [K in keyof T as K extends 'include' | 'select' ? K : never]: ReadonlyDeep<T[K]>
} & {
  [K in keyof T as K extends 'include' | 'select' ? never : K]: T[K]
} : never

export type { Args }
