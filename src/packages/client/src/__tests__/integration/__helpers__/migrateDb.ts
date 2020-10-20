import { Migrate } from "@prisma/migrate"
import { createDatabase } from "@prisma/sdk"

export type MigrateOptions = {
  connectionString: string
  schemaPath: string
}

export async function migrateDb({ connectionString, schemaPath }: MigrateOptions) {
  await createDatabase(connectionString)
  const migrate = new Migrate(schemaPath)

  try {
    await migrate.up({
      short: true,
      autoApprove: true
    })
  } catch (e) {
    console.error(e)
  }

  await migrate.watchUp({
    providerAliases: {},
    autoApprove: true,
    skipGenerate: true
  })

  migrate.stop()
}
