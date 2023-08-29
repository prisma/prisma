import { match, P } from 'ts-pattern'

import { Providers } from './providers'
import { type ProviderFlavor, ProviderFlavors } from './relationMode/ProviderFlavor'

export type ComputeSchemaHeader = {
  provider: Providers
  relationMode?: string
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
  let relationModeLine = ''
  if (provider === Providers.MONGODB) {
    // do nothing
  } else if (
    !relationMode &&
    (providerFlavor === ProviderFlavors.JS_PLANETSCALE || providerFlavor === ProviderFlavors.VITESS_8)
  ) {
    // Set relationMode to prisma for tests running on Vitess to avoid the following error:
    // VT10001: foreign key constraints are not allowed
    relationModeLine = `relationMode = "prisma"`
  } else if (relationMode) {
    relationModeLine = `relationMode = "${relationMode}"`
  }

  const previewFeaturesLine = previewFeatures ? `previewFeatures = ["${previewFeatures}"]` : ''
  const engineTypeLine = engineType ? `engineType = ["${engineType}"]` : ''

  const isDataProxy = Boolean(process.env.TEST_DATA_PROXY)
  const url = match({ provider, providerFlavor, isDataProxy })
    .with({ provider: Providers.SQLITE }, () => `"file:./test.db"`)
    .with({ providerFlavor: P.string, isDataProxy: false }, () => `env("DATABASE_URI_${providerFlavor}")`)
    .otherwise(({ provider }) => `env("DATABASE_URI_${provider}")`)

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
