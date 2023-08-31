import { match, P } from 'ts-pattern'

import { type ProviderFlavor, ProviderFlavors } from './providerFlavors'
import { Providers } from './providers'

export type ComputeSchemaHeader = {
  provider: Providers
  providerFlavor?: ProviderFlavor
  relationMode?: string
  previewFeatures?: string
  engineType?: 'binary' | 'library'
  directUrl?: string
  customUrl?: string
  schemas?: string[]
}

export function computeSchemaHeader({
  provider,
  providerFlavor,
  relationMode,
  previewFeatures,
  engineType,
  directUrl,
  customUrl,
  schemas,
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

  const sqliteDbUrl = `"file:./test.db"`

  const directUrlLine = match({ provider, directUrl })
    .with({ directUrl: P.string, provider: Providers.SQLITE }, () => `directUrl = ${sqliteDbUrl}`)
    .with({ directUrl: P.string }, () => `directUrl = ${directUrl}`)
    .otherwise(() => '')
  const schemasLine = schemas ? `schemas = ["${schemas.join('", "')}"]` : ''
  const datasourceLines = [relationModeLine, directUrlLine, schemasLine].filter(Boolean).join('\n  ')

  const previewFeaturesLine = previewFeatures ? `previewFeatures = ["${previewFeatures}"]` : ''
  const engineTypeLine = engineType ? `engineType = ["${engineType}"]` : ''
  const generatorLines = [previewFeaturesLine, engineTypeLine].filter(Boolean).join('\n  ')

  const isDataProxy = Boolean(process.env.TEST_DATA_PROXY)
  const url = match({ provider, providerFlavor, isDataProxy, customUrl })
    .with({ customUrl: P.string }, () => `"${customUrl}"`)
    .with({ provider: Providers.SQLITE }, () => sqliteDbUrl)
    .with({ providerFlavor: P.string }, () => `env("DATABASE_URI_${providerFlavor}")`)
    .otherwise(({ provider }) => `env("DATABASE_URI_${provider}")`)

  const providerName = match({ provider, providerFlavor })
    // This could be useful for inspiration for D1 later
    // .with({ provider: Providers.MYSQL, providerFlavor: ProviderFlavors.JS_PLANETSCALE }, () => '@prisma/planetscale')
    .otherwise(({ provider }) => provider)

  const schemaHeader = /* Prisma */ `
generator client {
  provider = "prisma-client-js"
  ${generatorLines}
}

datasource db {
  provider = "${providerName}"
  url = ${url}
  ${datasourceLines}
}`

  return schemaHeader
}
