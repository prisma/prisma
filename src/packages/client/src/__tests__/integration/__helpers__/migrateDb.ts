import { Migrate } from "@prisma/migrate"
import { createDatabase } from "@prisma/sdk"

export type MigrateOptions = {
  connectionString: string
  schemaPath: string
}

export async function migrateDb({ connectionString, schemaPath }: MigrateOptions) {
  const created = await createDatabase(connectionString)
  const migrate = new Migrate(schemaPath)

  await migrate.push({
    force: true
  })

  migrate.stop()
}
