import { createDatabase } from '@prisma/internals'
import { Migrate } from '@prisma/migrate'

export type MigrateOptions = {
  connectionString: string
  schemaPath: string
}

export async function migrateDb({ connectionString, schemaPath }: MigrateOptions) {
  await createDatabase(connectionString)
  const migrate = new Migrate(schemaPath)

  try {
    await migrate.push({
      force: true,
    })
  } finally {
    migrate.stop()
  }
}
