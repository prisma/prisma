import { Providers } from './providers'

export enum ProviderFlavors {
  VITESS_8 = 'vitess_8',
  JS_PLANETSCALE = 'js_planetscale',
  // JS_NEON = 'js_neon',
}

const allProviderFlavors = [...Object.values(Providers), ...Object.values(ProviderFlavors)] as const

export const allProvidersMatrix = allProviderFlavors.map((providerFlavor) => {
  const provider = getProviderFromFlavor(providerFlavor)

  console.log('providerFlavor', providerFlavor, 'provider', provider)
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

export type ProviderFlavor = (typeof allProviderFlavors)[number]

export function getProviderFromFlavor(providerFlavor: ProviderFlavor): Providers {
  switch (providerFlavor) {
    case ProviderFlavors.VITESS_8:
    case ProviderFlavors.JS_PLANETSCALE:
      return Providers.MYSQL
    // case ProviderFlavors.JS_NEON:
    //   return Providers.POSTGRESQL
    default:
      return providerFlavor
  }
}
