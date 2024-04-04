import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import { getSchemaPath } from '@prisma/internals'

import { ensureDatabaseExists } from '../utils/ensureDatabaseExists'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

it('can create database - sqlite', async () => {
  ctx.fixture('schema-only-sqlite')
  const schemaPath = (await getSchemaPath())!
  const result = ensureDatabaseExists('create', schemaPath)
  await expect(result).resolves.toMatchInlineSnapshot(`"SQLite database dev.db created at file:dev.db"`)
})

//
// Would need logic to be reproducible for testing other databases
// createDatabase is already tested in the `@prisma/internals` tests
//
