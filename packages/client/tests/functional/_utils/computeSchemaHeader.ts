import { match } from 'ts-pattern'

import { Providers } from './providers'
import { type ProviderFlavor, ProviderFlavors } from './relationMode/ProviderFlavor'

export type ComputeSchemaHeader = {
  provider: Providers
  relationMode: string
  providerFlavor?: ProviderFlavor
  previewFeatures?: string
  engineType?: 'binary' | 'library'
}

export function computeSchemaHeader({
  provider,
  providerFlavor,
  previewFeatures,
  engineType,
  relationMode,
}: ComputeSchemaHeader): string {
  // if relationModeLine is not defined, we do not add the line
  // if relationModeLine is defined
  // we add the line only if the provider is not MongoDB, since MongoDB doesn't need the setting, it's on by default
  const relationModeLine = provider === Providers.MONGODB || !relationMode ? '' : `relationMode = "${relationMode}"`
  const previewFeaturesLine = previewFeatures ? `previewFeatures = ["${previewFeatures}"]` : ''
  const engineTypeLine = engineType ? `engineType = ["${engineType}"]` : ''

  const url = match({ provider, providerFlavor })
    .with({ provider: Providers.SQLITE }, () => `"file:./test.db"`)
    .otherwise(({ providerFlavor }) => `env("DATABASE_URI_${providerFlavor}")`)

  const providerName = match({ provider, providerFlavor })
    .with({ provider: Providers.MYSQL, providerFlavor: ProviderFlavors.JS_PLANETSCALE }, () => '@prisma/planetscale')
    .with({ provider: Providers.POSTGRESQL, providerFlavor: ProviderFlavors.JS_NEON }, () => '@prisma/neon')
    .otherwise(({ provider }) => provider)

  const schemaHeader = /* Prisma */ `
generator client {
  provider = "prisma-client-js"
  ${previewFeaturesLine}
  ${engineTypeLine}
}

datasource db {
  provider = "${providerName}"
  url = ${url}
  ${relationModeLine}
}
  `

  return schemaHeader
}
