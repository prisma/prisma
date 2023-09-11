import { Providers } from './providers'

export enum ProviderFlavors {
  JS_PG = 'js_pg',
  VITESS_8 = 'vitess_8',
  JS_PLANETSCALE = 'js_planetscale',
  JS_NEON = 'js_neon',
}

const allProviderFlavors = [...Object.values(Providers), ...Object.values(ProviderFlavors)] as const

export const allProvidersMatrix = allProviderFlavors.map((providerFlavor) => {
  const provider = getProviderFromFlavor(providerFlavor)

  if (providerFlavor === provider) {
    return {
      provider,
    }
  } else {
    return {
      provider,
      providerFlavor,
    }
  }
})

export const allSqlProvidersMatrix = allProvidersMatrix.filter((it) => {
  const isMongoDb = it.provider === Providers.MONGODB
  return !isMongoDb
})

export type ProviderFlavor = (typeof allProviderFlavors)[number]

export function getProviderFromFlavor(providerFlavor: ProviderFlavor): Providers {
  switch (providerFlavor) {
    case ProviderFlavors.JS_NEON:
    case ProviderFlavors.JS_PG:
      return Providers.POSTGRESQL
    case ProviderFlavors.VITESS_8:
    case ProviderFlavors.JS_PLANETSCALE:
      return Providers.MYSQL
    default:
      return providerFlavor
  }
}
