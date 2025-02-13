import { defineMatrix } from '../../_utils/defineMatrix'
import { allProviders } from '../../_utils/providers'

const conflictingModels = [
  'ModelUpdate',
  'ModelDefault',
  'ModelSelect',
  'ModelInclude',
  'ModelResult',
  'ModelDelete',
  'ModelUpsert',
  'ModelAggregate',
  'ModelCount',
  'ModelPayload',
  'ModelFieldRefs',
  'ModelGroupBy',
] as const

export default defineMatrix(() => [allProviders, conflictingModels.map((conflictingModel) => ({ conflictingModel }))])
