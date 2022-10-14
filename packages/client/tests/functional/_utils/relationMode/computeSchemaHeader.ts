import { match } from 'ts-pattern'

import { Providers } from '../providers'

export type ComputeSchemaHeader = {
  provider: Providers
  previewFeatures: string
  relationMode: string
}

export function computeSchemaHeader({ provider, previewFeatures, relationMode }: ComputeSchemaHeader): string {
  const USE_PLANETSCALE = false

  // if relationModeLine is not defined, we do not add the line
  // if relationModeLine is defined
  // we add the line only if the provider is not MongoDB, since MongoDB doesn't need the setting, it's on by default
  const relationModeLine = provider === Providers.MONGODB || !relationMode ? '' : `relationMode = "${relationMode}"`

  const url = match(provider)
    .when(
      (_provider) => USE_PLANETSCALE && _provider === Providers.MYSQL,
      (_provider) => `"mysql://root:root@127.0.0.1:33807/PRISMA_DB_NAME"`,
    )
    .with(Providers.SQLITE, (_provider) => `"file:test.db"`)
    .otherwise((_provider) => `env("DATABASE_URI_${provider}")`)

  const schemaHeader = /* Prisma */ `
generator client {
  provider = "prisma-client-js"
  previewFeatures = [${previewFeatures}]
}

datasource db {
  provider = "${provider}"
  url = ${url}
  ${relationModeLine}
}
  `

  return schemaHeader
}
