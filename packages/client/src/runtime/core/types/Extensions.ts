import { Args } from '../extensions/$extends'
import { Merge, Omit } from './Utils'

export type GetResultPayload<Base extends object, R extends Args['result'][string]> =
  // the we override the default Base properties with the properties of `result`
  Base extends unknown ? Merge<{}, Base, { [K in keyof R]: ReturnType<R[K]['compute']> }> : never

export type GetResultSelect<Base extends object, R extends Args['result'][string]> =
  //
  Base & { [K in keyof R]?: true }

export type GetModel<Base extends object, M extends Args['model'][string]> = Merge<Base, M, {}>

export type { Args }
