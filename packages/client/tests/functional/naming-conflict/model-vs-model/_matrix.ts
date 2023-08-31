import { defineMatrix } from '../../_utils/defineMatrix'
import { allProvidersMatrix } from '../../_utils/providerFlavors'

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

export default defineMatrix(() => [
  allProvidersMatrix,
  conflictingModels.map((conflictingModel) => ({ conflictingModel })),
])
