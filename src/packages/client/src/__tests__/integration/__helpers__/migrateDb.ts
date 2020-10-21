import { Migrate } from "@prisma/migrate"
import { createDatabase } from "@prisma/sdk"

export type MigrateOptions = {
  connectionString: string
  schemaPath: string
}

export async function migrateDb({ connectionString, schemaPath }: MigrateOptions) {
  const created = await createDatabase(connectionString)
  console.log(created)
  const migrate = new Migrate(schemaPath)

  // const migration = await migrate.createMigration('DUMMY')
  // const { files, newLockFile, migrationId } = await migrate.save(
  //   migration!,
  //   'DUMMY',
  //   false,
  // )

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
