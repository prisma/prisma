// import Debug from '@prisma/debug'

// import { MigrateEngine } from '../MigrateEngine'

// const debug = Debug('prisma:cli')

/**
 * Retrieve the database version from the given schema or url.
 * This function never throws, and was introduced to prevent circular dependencies in `@prisma/internals`.
 */
export function getDatabaseVersionSafe(schemaOrUrl: string): Promise<string | undefined> {
  void schemaOrUrl
  return Promise.resolve(undefined)
  // TODO: uncomment once https://github.com/prisma/prisma-private/issues/203 is closed.

  // let engine: MigrateEngine | undefined
  // let dbVersion: string | undefined
  // try {
  //   engine = new MigrateEngine({
  //     projectDir: process.cwd(),
  //   })
  //   dbVersion = await engine.getDatabaseVersion({ schema: schemaOrUrl })
  // } catch (e) {
  //   debug(e)
  // } finally {
  //   if (engine && engine.isRunning) {
  //     engine.stop()
  //   }
  // }
  //
  // return dbVersion
}
