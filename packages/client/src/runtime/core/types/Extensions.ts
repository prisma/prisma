import { RequiredArgs as UserArgs } from '../extensions/$extends'
import { ReadonlyDeep, WrapPropsInFnDeep } from './Utils'

/* eslint-disable prettier/prettier */

export type Args = WrapPropsInFnDeep<UserArgs>

export type DefaultArgs = WrapPropsInFnDeep<{ result: {}; model: {}; query: {}; client: {} }>

export type GetResult<Base extends Record<any, any>, R extends Args['result'][string]> =
  { [K in keyof R | keyof Base]: K extends keyof R ? ReturnType<ReturnType<R[K]['compute']>> : Base[K] }

export type GetSelect<Base extends Record<any, any>, R extends Args['result'][string]> =
  { [K in keyof R | keyof Base]?: K extends keyof R ? boolean : Base[K] }

export type GetModel<Base extends Record<any, any>, M extends Args['model'][string]> =
  { [K in keyof M | keyof Base]: K extends keyof M ? ReturnType<M[K]> : Base[K] } 

export type GetClient<Base extends Record<any, any>, C extends Args['client']> =
  { [K in keyof C | keyof Base]: K extends keyof C ? ReturnType<C[K]>: Base[K] } 

export type ReadonlySelector<T> = T extends unknown ? {
  readonly [K in keyof T as K extends 'include' | 'select' ? K : never]: ReadonlyDeep<T[K]>
} & {
  [K in keyof T as K extends 'include' | 'select' ? never : K]: T[K]
} : never

/* eslint-enable prettier/prettier */

export type { UserArgs }
