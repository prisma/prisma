/* eslint-disable prettier/prettier */
import { RequiredArgs as Args } from '../extensions/$extends'
import { PatchFlat3 } from './Utils'

export type DefaultArgs = { result: {}; model: {}; query: {}; client: {} }

export type GetResultPayload<Base extends object, R extends Args['result'][string]> =
  //
  PatchFlat3<{}, { [K in keyof R]: ReturnType<R[K]['compute']> }, Base>

export type GetResultSelect<Base extends object, R extends Args['result'][string]> =
  //
  Base & { [K in keyof R]?: true }

export type GetModel<Base extends object, M extends Args['model'][string]> =
  //
  PatchFlat3<M, Base, {}>

export type GetClient<Base extends object, C extends Args['client'], CP extends Args['client']> =
  //
  PatchFlat3<C, CP, Base>

export type ReadonlySelector<T> = {
  readonly [K in keyof T as K extends 'include' | 'select' ? K : never]: ReadonlySelector<T[K]>
} & {
  [K in keyof T as K extends 'include' | 'select' ? never : K]: T[K]
}

export type MergeArgs<
  ExtArgs extends Args,
  PrevExtArgs extends Args,
  ModelNames extends string,
  ApplyAllModels extends boolean = true,
> = {
  result: '$allModels' extends keyof ExtArgs['result'] ? ApplyAllModels extends true
    ? { [K in ModelNames]: PatchFlat3<ExtArgs['result'][K], ExtArgs['result']['$allModels'], PrevExtArgs['result'][K]> }
    : { [K in keyof ExtArgs['result'] | keyof PrevExtArgs['result']]: PatchFlat3<{}, ExtArgs['result'][K], PrevExtArgs['result'][K]> }
    : { [K in keyof ExtArgs['result'] | keyof PrevExtArgs['result']]: PatchFlat3<{}, ExtArgs['result'][K], PrevExtArgs['result'][K]> }
  model: '$allModels' extends keyof ExtArgs['model'] ? ApplyAllModels extends true
    ? { [K in ModelNames]: PatchFlat3<ExtArgs['model'][K], ExtArgs['model']['$allModels'], PrevExtArgs['model'][K]> }
    : { [K in keyof ExtArgs['model'] | keyof PrevExtArgs['model']]: PatchFlat3<{}, ExtArgs['model'][K], PrevExtArgs['model'][K]> }
    : { [K in keyof ExtArgs['model'] | keyof PrevExtArgs['model']]: PatchFlat3<{}, ExtArgs['model'][K], PrevExtArgs['model'][K]> }
  client: PatchFlat3<{}, ExtArgs['client'], PrevExtArgs['client']>
  query: {}
}

export declare const EXT_ARGS: unique symbol

export type { Args }
