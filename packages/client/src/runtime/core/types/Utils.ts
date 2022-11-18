export type EmptyToUnknown<T> = T

export type NeverToUnknown<T> = [T] extends [never] ? unknown : T

export type PatchFlat<O1, O2> = O1 & Omit<O2, keyof O1>

export type PatchDeep<O1, O2, O = O1 & O2> = {
  /* eslint-disable prettier/prettier */
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
    /* eslint-enable */
} & unknown

export type Omit<T, K extends string | number | symbol> = {
  [P in keyof T as P extends K ? never : P]: T[P]
}

export type Pick<T, K extends string | number | symbol> = {
  [P in keyof T as P extends K ? P : never]: T[P]
}

export type Merge<A, B, C> = A & {
  [K in Exclude<keyof B | keyof C, keyof A>]: K extends keyof B ? B[K] : C[K & keyof C]
}

export type Compute<T> = T extends Function
  ? T
  : {
      [K in keyof T]: T[K]
    } & unknown
