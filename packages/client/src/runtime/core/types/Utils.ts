import { PrismaPromise } from '../request/PrismaPromise'

export type EmptyToUnknown<T> = T

export type NeverToUnknown<T> = [T] extends [never] ? unknown : T

export type PatchFlat<O1, O2> = O1 & Omit<O2, keyof O1>

export type Omit<T, K extends string | number | symbol> = {
  [P in keyof T as P extends K ? never : P]: T[P]
}

export type Pick<T, K extends string | number | symbol> = {
  [P in keyof T as P extends K ? P : never]: T[P]
}

export type ComputeDeep<T> = T extends Function ? T : { [K in keyof T]: ComputeDeep<T[K]> } & unknown

export type Compute<T> = T extends Function ? T : { [K in keyof T]: T[K] } & unknown

export type OptionalFlat<T> = {
  [K in keyof T]?: T[K]
}

export type ReadonlyDeep<T> = {
  readonly [K in keyof T]: ReadonlyDeep<T[K]>
}

type Narrowable = string | number | bigint | boolean | []

// prettier-ignore
export type Narrow<A> = {
  [K in keyof A]: A[K] extends Function ? A[K] : Narrow<A[K]>
} | (A extends Narrowable ? A : never)

// prettier-ignore
export type Exact<A, W> = (W extends A ? {
  [K in keyof W]: K extends keyof A ? Exact<A[K], W[K]> : never
} : W) | (A extends Narrowable ? A : never)

export type Cast<A, W> = A extends W ? A : W

type LegacyNarrowable = string | number | boolean | bigint

// prettier-ignore
export type LegacyExact<A, W = unknown> = 
  W extends unknown ? A extends LegacyNarrowable ? Cast<A, W> : Cast<
  { [K in keyof A]: K extends keyof W ? LegacyExact<A[K], W[K]> : never },
  { [K in keyof W]: K extends keyof A ? LegacyExact<A[K], W[K]> : W[K] }>
  : never;

export type JsonObject = { [Key in string]?: JsonValue }
export interface JsonArray extends Array<JsonValue> {}
export type JsonValue = string | number | boolean | JsonObject | JsonArray | null

export type Record<T extends string | number | symbol, U> = {
  [P in T]: U
}

type UnwrapPromise<P> = P extends Promise<infer R> ? R : P

export type UnwrapTuple<Tuple extends readonly unknown[]> = {
  [K in keyof Tuple]: K extends `${number}`
    ? Tuple[K] extends PrismaPromise<infer X>
      ? X
      : UnwrapPromise<Tuple[K]>
    : UnwrapPromise<Tuple[K]>
}

// prettier-ignore
export type Path<O, P, Default = never> =
  O extends unknown
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
  [K in keyof P as K extends 'scalars' | 'objects' | 'composites' ? keyof P[K] : never]:
    P[K] // we lift the value up with the same key name so we can flatten it later
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
