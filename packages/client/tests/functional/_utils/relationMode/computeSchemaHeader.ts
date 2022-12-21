import { match } from 'ts-pattern'

import { Providers } from '../providers'
import type { ProviderFlavor } from './ProviderFlavor'

export type ComputeSchemaHeader = {
  provider: Providers
  relationMode: string
  providerFlavor?: ProviderFlavor
  previewFeatures?: string
}

export function computeSchemaHeader({
  provider,
  providerFlavor,
  previewFeatures,
  relationMode,
}: ComputeSchemaHeader): string {
  // if relationModeLine is not defined, we do not add the line
  // if relationModeLine is defined
  // we add the line only if the provider is not MongoDB, since MongoDB doesn't need the setting, it's on by default
  const relationModeLine = provider === Providers.MONGODB || !relationMode ? '' : `relationMode = "${relationMode}"`

  const url = match({ provider, providerFlavor })
    .with({ provider: Providers.SQLITE }, () => `"file:test.db"`)
    .otherwise(({ providerFlavor }) => `env("DATABASE_URI_${providerFlavor}")`)

  const schemaHeader = /* Prisma */ `
generator client {
  provider = "prisma-client-js"
  ${previewFeatures ? `previewFeatures = ["${previewFeatures}"]` : ''}
}

datasource db {
  provider = "${provider}"
  url = ${url}
  ${relationModeLine}
}
  `

  return schemaHeader
}
