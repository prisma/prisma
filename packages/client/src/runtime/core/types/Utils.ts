/* eslint-disable prettier/prettier */

export type EmptyToUnknown<T> = T

export type NeverToUnknown<T> = [T] extends [never] ? unknown : T

export type PatchFlat<O1, O2> = O1 & Omit<O2, keyof O1>

export type PatchDeep<O1, O2, O = O1 & O2> = {
  [K in keyof O]:
    K extends keyof O1
    ? K extends keyof O2
      ? O1[K] extends object
        ? O2[K] extends object
          ? O1[K] extends Function
            ? O1[K]
            : O2[K] extends Function
              ? O1[K]
              : PatchDeep<O1[K], O2[K]>
          : O1[K]
        : O1[K]
      : O1[K]
    : O2[K & keyof O2]
}

export type Omit<T, K extends string | number | symbol> = {
  [P in keyof T as P extends K ? never : P]: T[P]
}

export type Pick<T, K extends string | number | symbol> = {
  [P in keyof T as P extends K ? P : never]: T[P]
}

/**
 * Patches 3 objects on top of each other with minimal looping.
 * This is a more efficient way of doing `PatchFlat<A, PatchFlat<B, C>>`
 */
export type PatchFlat3<A, B, C> = A & {
  [K in Exclude<keyof B | keyof C, keyof A>]: K extends keyof B ? B[K] : C[K & keyof C]
}

export type Compute<T> = T extends Function
  ? T
  : {
      [K in keyof T]: T[K]
    } & unknown

export type OptionalFlat<T> = {
  [K in keyof T]?: T[K]
}

export type ReadonlyDeep<T> = {
  readonly [K in keyof T]: ReadonlyDeep<T[K]>
}

type Narrowable = string | number | bigint | boolean | unknown[] | []

export type Narrow<A> = {
  [K in keyof A]: A[K] extends Function ? A[K] : Narrow<A[K]>
} | (A extends Narrowable ? A : never)

export type Exact<A, W> = (W extends A ? {
  [K in keyof W]: K extends keyof A ? Exact<A[K], W[K]> : W[K]
} : W) | (A extends Narrowable ? A : never)

export type Cast<A, W> = A extends W ? A : W

type LegacyNarrowable = string | number | boolean | bigint;
export type LegacyExact<A, W = unknown> = 
  W extends unknown ? A extends LegacyNarrowable ? Cast<A, W> : Cast<
  {[K in keyof A]: K extends keyof W ? LegacyExact<A[K], W[K]> : never},
  {[K in keyof W]: K extends keyof A ? LegacyExact<A[K], W[K]> : W[K]}>
  : never;
