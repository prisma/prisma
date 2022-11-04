import { Args } from '../extensions/$extends'
import * as Utils from './Utils'

export type GetResultTypes<T extends (Args['result'] & {})[string], F extends T['fields'] = T['fields']> =
  // if not a concrete type, return unknown otherwise return the value type
  [T] extends [never] ? unknown : { [K in keyof F]: ReturnType<F[K]> }

export type GetResultSelect<T extends (Args['result'] & {})[string], F extends T['fields'] = T['fields']> =
  // if not a concrete type, return unknown otherwise return the value type
  [T] extends [never] ? unknown : { [K in keyof Utils.EmptyToUnknown<F>]?: true }

export type { Args }
