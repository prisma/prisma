import { Args } from '../extensions/$extends'
import { Omit, PatchFlat } from './Utils'

export type GetResultPayload<
  Base extends object,
  ExtArgs extends Args,
  P extends keyof R,
  R extends Args['result'] & {} = ExtArgs['result'] & {},
  RP extends (Args['result'] & {})[string] = R[P],
> =
  // we force TypeScript to evaluate RP so that it can appear nicely to the user
  // the we override the default Base properties with the properties of `result`
  RP extends unknown ? Omit<Base, keyof RP> & { [K in keyof RP]: ReturnType<RP[K]['compute']> } : never

export type GetResultSelect<
  Base extends object,
  ExtArgs extends Args,
  P extends keyof R,
  R extends Args['result'] & {} = ExtArgs['result'] & {},
  RP extends (Args['result'] & {})[string] = PatchFlat<R[P], R['$allModels']>,
> = Base & { [K in keyof RP]?: true }

export type GetModel<
  Base extends object,
  ExtArgs extends Args,
  P extends keyof M,
  M extends Args['model'] & {} = ExtArgs['model'] & {},
  MP extends (Args['model'] & {})[string] = M[P],
> = Omit<Base, keyof MP> & MP

export type { Args }
