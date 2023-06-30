/* eslint-disable prettier/prettier */

import { GetResult, Operation } from './GetResult'
import { Exact } from './Utils'

/*
 * /!\ These types are exposed to the user. Proceed with caution.
 *
 * TODO: Move more hardcoded types from generation into here
 */

export type Args<T, F extends Operation> =
  T extends { [K: symbol]: { types: { operations: { [K in F]: { args: any } } } } }
  ? T[symbol]['types']['operations'][F]['args']
  : never

export type Result<T, A, F extends Operation> =
  T extends { [K: symbol]: { types: { payload: any } } }
  ? GetResult<T[symbol]['types']['payload'], A, F>
  : never

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type Payload<T, F extends Operation = never> =
  T extends { [K: symbol]: { types: { payload: any } } }
  ? T[symbol]['types']['payload']
  : never

// we don't expose our internal types to keep the API secret
export interface PrismaPromise<T> extends Promise<T> {
  [Symbol.toStringTag]: 'PrismaPromise'
}

export { type Operation }

export { type Exact }
