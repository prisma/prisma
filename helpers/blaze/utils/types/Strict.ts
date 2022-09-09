/* eslint-disable @typescript-eslint/no-unsafe-argument */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { A } from 'ts-toolbelt'

type Strict<U, _U = U> = U extends object ? U & { [K in Exclude<A.Keys<_U>, keyof U>]?: never } : U

export type { Strict }
