export type ReadonlyDeep<O> = {
  +readonly [K in keyof O]: ReadonlyDeep<O[K]>
}
