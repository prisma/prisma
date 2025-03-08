import type { PrismaPromise } from './Public'

export type EmptyToUnknown<T> = T

export type NeverToUnknown<T> = [T] extends [never] ? unknown : T

export type PatchFlat<O1, O2> = O1 & Omit<O2, keyof O1>

export type Omit<T, K extends string | number | symbol> = {
  [P in keyof T as P extends K ? never : P]: T[P]
}

export type Pick<T, K extends string | number | symbol> = {
  [P in keyof T as P extends K ? P : never]: T[P]
}

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type ComputeDeep<T> = T extends Function ? T : { [K in keyof T]: ComputeDeep<T[K]> } & unknown

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export type Compute<T> = T extends Function ? T : { [K in keyof T]: T[K] } & unknown

export type OptionalFlat<T> = {
  [K in keyof T]?: T[K]
}

export type ReadonlyDeep<T> = {
  readonly [K in keyof T]: ReadonlyDeep<T[K]>
}

export type Narrowable = string | number | bigint | boolean | []

// prettier-ignore
export type Narrow<A> =
  | {
      [K in keyof A]: A[K] extends Function ? A[K] : Narrow<A[K]>
    }
  | (A extends Narrowable ? A : never)

export type Exact<A, W> =
  | (A extends unknown ? (W extends A ? { [K in keyof A]: Exact<A[K], W[K]> } : W) : never)
  | (A extends Narrowable ? A : never)

export type Cast<A, W> = A extends W ? A : W

export type Record<T extends string | number | symbol, U> = {
  [P in T]: U
}

export type UnwrapPromise<P> = P extends Promise<infer R> ? R : P

export type UnwrapTuple<Tuple extends readonly unknown[]> = {
  [K in keyof Tuple]: K extends `${number}`
    ? Tuple[K] extends PrismaPromise<infer X>
      ? X
      : UnwrapPromise<Tuple[K]>
    : UnwrapPromise<Tuple[K]>
}

// prettier-ignore
export type Path<O, P, Default = never> = O extends unknown
  ? P extends [infer K, ...infer R]
    ? K extends keyof O
      ? Path<O[K], R>
      : Default
    : O
  : never

export interface Fn<Params = unknown, Returns = unknown> {
  params: Params
  returns: Returns
}

export type Call<F extends Fn, P> = (F & { params: P })['returns']

export type RequiredKeys<O> = {
  [K in keyof O]-?: {} extends Pick<O, K> ? never : K
}[keyof O]

export type OptionalKeys<O> = {
  [K in keyof O]-?: {} extends Pick<O, K> ? K : never
}[keyof O]

export type Optional<O, K extends keyof any = keyof O> = {
  [P in K & keyof O]?: O[P]
} & {
  [P in Exclude<keyof O, K>]: O[P]
}

export type Return<T> = T extends (...args: any[]) => infer R ? R : T

export type ToTuple<T> = T extends any[] ? T : [T]
// prettier-ignore
export type RenameAndNestPayloadKeys<P> = {
  [K in keyof P as K extends 'scalars' | 'objects' | 'composites' ? keyof P[K] : never]: P[K] // we lift the value up with the same key name so we can flatten it later
}

// prettier-ignore
export type PayloadToResult<P, O extends Record<any, any> = RenameAndNestPayloadKeys<P>> = {
  [K in keyof O]?: O[K][K] extends any[]
    ? PayloadToResult<O[K][K][number]>[]
    : O[K][K] extends object
      ? PayloadToResult<O[K][K]>
      : O[K][K]
}

export type Select<T, U> = T extends U ? T : never

// prettier-ignore
export type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? 1 : 0

export type Or<A extends 1 | 0, B extends 1 | 0> = {
  0: {
    0: 0
    1: 1
  }
  1: {
    0: 1
    1: 1
  }
}[A][B]

// This alias is necessary to allow to use `Promise` as a model name.
// It's used in generated client instead of global `Promise`.
// Why conditional intersection with {}?. Without it, in the error messages
// and editor tooltips, type would be displayed as $Utils.JsPromise<T>.
// Intersection allows us to preserve the name `Promise`
export type JsPromise<T> = Promise<T> & {}
