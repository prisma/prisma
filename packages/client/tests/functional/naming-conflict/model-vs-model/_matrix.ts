import { defineMatrix } from '../../_utils/defineMatrix'
import { ProviderFlavors } from '../../_utils/providerFlavors'

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
    // {
    //   provider: 'postgresql',
    //   providerFlavor: 'js_neon',
    // },
    {
      provider: 'mysql',
    },
    {
      provider: 'mysql',
      providerFlavor: ProviderFlavors.VITESS_8,
    },
    {
      provider: 'mysql',
      providerFlavor: ProviderFlavors.JS_PLANETSCALE,
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
