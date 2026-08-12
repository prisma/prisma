export type SimplifyDeep<T> = T extends readonly (infer Element)[]
  ? T extends unknown[]
    ? SimplifyDeep<Element>[]
    : readonly SimplifyDeep<Element>[]
  : T extends
        | string
        | number
        | boolean
        | bigint
        | symbol
        | Date
        | RegExp
        | Uint8Array
        | ((...args: never[]) => unknown)
    ? T
    : T extends object
      ? { [K in keyof T]: SimplifyDeep<T[K]> }
      : T;
