import Debug from '@prisma/debug'
import { MigrateTypes } from '@prisma/internals'

import { Migrate } from '../Migrate'

const debug = Debug('prisma:cli')

/**
 * Retrieve the database version from the given schema or url.
 * This function never throws, and was introduced to prevent circular dependencies in `@prisma/internals`.
 */
export async function getDatabaseVersionSafe(
  args: MigrateTypes.GetDatabaseVersionParams | undefined,
): Promise<string | undefined> {
  let migrate: Migrate | undefined
  let dbVersion: string | undefined
  try {
    migrate = await Migrate.setup({})
    dbVersion = await migrate.engine.getDatabaseVersion(args)
  } catch (e) {
    debug(e)
  } finally {
    if (migrate && migrate.engine.isRunning) {
      migrate.stop()
    }
  }

  return dbVersion
}
