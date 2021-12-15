import type { Action, Client } from '../../getPrismaClient'
import { aggregate } from './aggregates/aggregate'
import { count } from './aggregates/count'
import { groupBy } from './aggregates/groupBy'
import type { ModelAction } from './applyModel'

export function applyAggregates(client: Client, action: Action, modelAction: ModelAction) {
  if (action === 'aggregate') return (userArgs: object) => aggregate(client, userArgs, modelAction)
  if (action === 'count') return (userArgs: object) => count(client, userArgs, modelAction)
  if (action === 'groupBy') return (userArgs: object) => groupBy(client, userArgs, modelAction)

  return undefined
}
