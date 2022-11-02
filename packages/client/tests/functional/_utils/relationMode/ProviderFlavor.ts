import { Providers } from '../providers'

export enum ProviderFlavors {
  VITESS_8 = 'vitess_8',
}

const providerFlavors = [...Object.values(Providers), ProviderFlavors.VITESS_8] as const
export type ProviderFlavor = typeof providerFlavors[number]

export function getProviderFromFlavor(providerFlavor: ProviderFlavor): Providers {
  switch (providerFlavor) {
    case ProviderFlavors.VITESS_8:
      return Providers.MYSQL
    default:
      return providerFlavor
  }
}
