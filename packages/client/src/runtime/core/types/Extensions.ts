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

export type GetResult<Base extends Record<any, any>, R extends Args['result'][string]> =
  string extends keyof R // prevents unnecessary computation & string indexes to be passed (= default state)
  ? Base
  : { [K in keyof R | keyof Base]: K extends keyof R ? ReturnType<ReturnType<R[K]>['compute']> : Base[K] } & unknown

export type GetSelect<Base extends Record<any, any>, R extends Args['result'][string]> =
  string extends keyof R // prevents unnecessary computation & string indexes to be passed (= default state)
  ? Base
  : { [K in keyof R | keyof Base]?: K extends keyof R ? boolean : Base[K] }

export type GetModel<Base extends Record<any, any>, M extends Args['model'][string]> =
  string extends keyof M // prevents unnecessary computation & string indexes to be passed (= default state)
  ? Base
  : { [K in keyof M | keyof Base]: K extends keyof M ? ReturnType<M[K]> : Base[K] }

export type GetClient<Base extends Record<any, any>, C extends Args['client']> =
  string extends keyof C // prevents unnecessary computation & string indexes to be passed (= default state)
  ? Base
  : Omit<Base, keyof C | '$use'> & { [K in keyof C]: ReturnType<C[K]> }

export type GetMaybeITXClient<Base extends Record<any, any>, C extends Args['client']> =
  string extends keyof C // prevents unnecessary computation & string indexes to be passed (= default state)
  ? Base
  : MakeITXPropsOptional<GetClient<Base, C>>

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
