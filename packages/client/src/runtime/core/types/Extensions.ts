import { ITXClientDenyList } from '../../itxClientDenyList'
import { RequiredArgs as UserArgs } from '../extensions/$extends'
import { ReadonlyDeep } from './Utils'

/* eslint-disable prettier/prettier */

export type InternalArgs<
  R extends UserArgs['result'] = UserArgs['result'],
  M extends UserArgs['model'] = UserArgs['model'],
  Q extends UserArgs['query'] = UserArgs['query'],
  C extends UserArgs['client'] = UserArgs['client'],
> = {
  result: { [K in keyof R]: { [P in keyof R[K]]: () => R[K][P] } },
  model: { [K in keyof M]: { [P in keyof M[K]]: () => M[K][P] } },
  query: { [K in keyof Q]: { [P in keyof Q[K]]: () => Q[K][P] } },
  client: { [K in keyof C]: () => C[K] },
}

export type Args = InternalArgs

export type DefaultArgs = InternalArgs<{}, {}, {}, {}>

export type GetResult<Base extends Record<any, any>, R extends Args['result'][string], _R extends Args['result'][string] = Record<string, any> extends R ? {} : R> =
  { [K in keyof _R | keyof Base]: K extends keyof _R ? ReturnType<ReturnType<_R[K]>['compute']> : Base[K] } & unknown

export type GetSelect<Base extends Record<any, any>, R extends Args['result'][string], _R extends Args['result'][string] = Record<string, any> extends R ? {} : R> =
  { [K in keyof _R | keyof Base]?: K extends keyof _R ? boolean : Base[K] }

export type GetModel<Base extends Record<any, any>, M extends Args['model'][string], _M extends Args['model'][string] = Record<string, any> extends M ? {} : M> =
  { [K in keyof _M | keyof Base]: K extends keyof _M ? ReturnType<_M[K]> : Base[K] }

export type GetClient<Base extends Record<any, any>, C extends Args['client'], _C extends Args['model'][string] = Record<string, any> extends C ? {} : C> =
  { [K in keyof _C | Exclude<keyof Base, '$use' | '$on'>]: K extends keyof _C ? ReturnType<_C[K]> : Base[K] }

export type GetMaybeITXClient<Base extends Record<any, any>, C extends Args['client']> =
  MakeITXPropsOptional<GetClient<Base, C>>

type MakeITXPropsOptional<C> = Omit<C, ITXClientDenyList> & {
  [K in Extract<keyof C, ITXClientDenyList>]?: C[K]
}

export type ReadonlySelector<T> = T extends unknown ? {
  readonly [K in keyof T as K extends 'include' | 'select' ? K : never]: ReadonlyDeep<T[K]>
} & {
  [K in keyof T as K extends 'include' | 'select' ? never : K]: T[K]
} : never

/* eslint-enable prettier/prettier */

export type { UserArgs }
