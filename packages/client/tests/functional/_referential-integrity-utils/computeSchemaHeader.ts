import { match } from 'ts-pattern'
import { Providers } from '../_utils/providers'

export type ComputeSchemaHeader = {
  provider: Providers
  previewFeatures: string
  referentialIntegrity: string
}

export function computeSchemaHeader({ provider, previewFeatures, referentialIntegrity }: ComputeSchemaHeader): string {
  const USE_PLANETSCALE = false

  // if referentialIntegrity is not defined, we do not add the line
  // if referentialIntegrity is defined
  // we add the line only if the provider is not MongoDB, since MongoDB doesn't need the setting, it's on by default
  const referentialIntegrityLine =
    provider === Providers.MONGODB || !referentialIntegrity ? '' : `referentialIntegrity = "${referentialIntegrity}"`

  const url = match(provider)
    .when(_provider => USE_PLANETSCALE && _provider === Providers.MYSQL, (_provider) =>
      `"mysql://root:root@127.0.0.1:33807/PRISMA_DB_NAME"`
    )
    .with(Providers.SQLITE, _provider => 
      `"file:test.db"` 
    )
    .otherwise(_provider => 
      `env("DATABASE_URI_${provider}")`
    )

  const schemaHeader = /* Prisma */ `
generator client {
  provider = "prisma-client-js"
  previewFeatures = [${previewFeatures}]
}

datasource db {
  provider = "${provider}"
  url = ${url}
  ${referentialIntegrityLine}
}
  `

  return schemaHeader
}
