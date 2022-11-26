import { RequiredArgs as Args } from '../extensions/$extends'
import { PatchFlat3 } from './Utils'

export type DefaultArgs = { result: {}; model: {}; query: {}; client: {} }

export type GetResultPayload<Base extends object, R extends Args['result'][string]> =
  //
  PatchFlat3<{}, { [K in keyof R]: ReturnType<R[K]['compute']> }, Base>

export type GetResultSelect<Base extends object, R extends Args['result'][string]> =
  //
  Base & { [K in keyof R]?: true }

export type GetModel<Base extends object, M extends Args['model'][string]> =
  //
  PatchFlat3<M, Base, {}>

export type { Args }
