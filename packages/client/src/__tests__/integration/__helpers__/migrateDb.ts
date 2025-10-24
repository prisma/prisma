import { defaultTestConfig, PrismaConfigInternal } from '@prisma/config'
import { DbPush } from '@prisma/migrate'

/**
 * Creates/Resets the database and apply necessary SQL to be in sync with the provided Prisma schema
 * Run `db push --force-reset --skip-generate` using the provided schema and configured datasource
 */
export async function migrateDb({ schemaPath }: { schemaPath: string }) {
  const consoleInfoMock = jest.spyOn(console, 'info').mockImplementation()
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set before calling migrateDb.')
  }

  const runtimeConfig: PrismaConfigInternal = {
    ...defaultTestConfig(),
    engine: 'classic',
    schema: schemaPath,
    datasource: {
      url: databaseUrl,
    },
  }

  await DbPush.new().parse(['--force-reset', '--skip-generate'], runtimeConfig)
  consoleInfoMock.mockRestore()
}
