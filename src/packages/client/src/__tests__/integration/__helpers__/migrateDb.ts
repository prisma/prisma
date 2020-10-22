import { Migrate } from "@prisma/migrate"
import { createDatabase, dropDatabase } from "@prisma/sdk"

export type MigrateOptions = {
  connectionString: string
  schemaPath: string
}

export async function migrateDb({ connectionString, schemaPath }: MigrateOptions) {
  await createDatabase(connectionString)
  const migrate = new Migrate(schemaPath, ['nativeTypes'])

  await migrate.push({
    force: true
  })

  migrate.stop()
}
