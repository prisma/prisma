import { match } from 'ts-pattern'

import { Providers } from '../../_utils/providers'
import testMatrix from '../_matrix'
import { schema_1to1 } from './_schema_1_to_1'
import { schema_1ton } from './_schema_1_to_n'

// Note: We can't test `SetDefault` with automatically created ids in SQLServer.
// Had we defined Prisma models with automatic ids in the form of `id Int @id @default(autoincrement())`,
// SQL Server would have thrown a runtime error at the `CREATE TABLE` level, as Prisma would use the IDENTITY(1, 1) type
// for the id column, which cannot be created or updated explicitly.
// The escape hatch would be using `SET IDENTITY_INSERT OFF`, which is however allowed only for a single table per session,
// and isn't supported by Prisma (not even in raw mode, see https://github.com/prisma/prisma/issues/15305)
//
// The obvious solution for us was to avoid `@default(autoincrement())` in tests.
// Providing a separate `id` schema definition for each provider is not necessary.
export default testMatrix.setupSchema(({ provider, providerFlavor, defaultUserId }) => {
  const url = match({ provider, providerFlavor })
    .with({ provider: Providers.SQLITE }, () => `"file:test.db"`)
    .otherwise(({ providerFlavor }) => `env("DATABASE_URI_${providerFlavor}")`)

  const schema = /* prisma */ `
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "${provider}"
  url = ${url}
}

${schema_1to1(defaultUserId)}
${schema_1ton(defaultUserId)}
  `

  return schema
})
