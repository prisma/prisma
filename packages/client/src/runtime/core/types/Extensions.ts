import { Args } from '../extensions/$extends'
import { PatchFlat3 } from './Utils'

export type GetResultPayload<Base extends object, R extends Args['result'][string]> =
  // here, we distribute the type to force typescript to display results nicer
  Base extends unknown ? PatchFlat3<Base, { [K in keyof R]: ReturnType<R[K]['compute']> }, {}> : never

export type GetResultSelect<Base extends object, R extends Args['result'][string]> = Base & { [K in keyof R]?: true }

export type GetModel<Base extends object, M extends Args['model'][string]> = PatchFlat3<Base, M, {}>

export type { Args }
