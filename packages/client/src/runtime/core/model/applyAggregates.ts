import type { Client } from '../../getPrismaClient'
import type { PrismaPromise } from '../request/PrismaPromise'
import type { ModelAction } from './applyModel'

export function applyAggregates(client: Client, dmmfModelName: string, modelAction: ModelAction) {
  return (userArgs: object) => {}
}
