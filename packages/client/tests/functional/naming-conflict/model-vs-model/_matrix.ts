import { defineMatrix } from '../../_utils/defineMatrix'

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
  [
    {
      provider: 'sqlite',
    },
    {
      provider: 'postgresql',
    },
    {
      provider: 'postgresql',
      providerFlavor: 'js_neon',
    },
    {
      provider: 'mysql',
    },
    {
      provider: 'mongodb',
    },
    {
      provider: 'cockroachdb',
    },
    {
      provider: 'sqlserver',
    },
  ],
  conflictingModels.map((conflictingModel) => ({ conflictingModel })),
])
