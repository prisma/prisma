import { Args } from '../extensions/$extends'

export type GetResultTypes<T extends (Args['result'] & {})[string]> =
  // if not a concrete type, return unknown otherwise return the value type
  [T] extends [never] ? unknown : { [K in keyof T]: ReturnType<T[K]['compute']> }

export type GetResultSelect<T extends (Args['result'] & {})[string]> =
  // if not a concrete type, return unknown otherwise return the value type
  [T] extends [never] ? unknown : { [K in keyof T]?: true }

export type { Args }
