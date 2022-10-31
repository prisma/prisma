import { DbPush } from '@prisma/migrate'

/**
 * Creates/Resets the database and apply necessary SQL to be in sync with the provided Prisma schema
 * Run `db push --schema schemaPath --force-reset --skip-generate`
 */
export async function migrateDb({ connectionString, schemaPath }: { connectionString: string; schemaPath: string }) {
  const consoleInfoMock = jest.spyOn(console, 'info').mockImplementation()
  await DbPush.new().parse(['--schema', schemaPath, '--force-reset', '--skip-generate'])
  consoleInfoMock.mockRestore()
}
