/* eslint-disable jest/no-identical-title */

import { jestContext } from '@prisma/internals'
import { DbExecute, DbPull, DbPush, MigrateDev, MigrateReset } from '@prisma/migrate'
import fs from 'fs'

import { Format } from '../Format'
import { Validate } from '../Validate'

const ctx = jestContext.new().assemble()

const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

describeIf(process.env.PRISMA_CLI_QUERY_ENGINE_TYPE === 'library')('empty-schema library', () => {
  beforeEach(() => {
    ctx.fixture('empty-schema/prisma')
  })

  it('validate', async () => {
    await expect(Validate.new().parse([])).rejects.toMatchInlineSnapshot(`
      Get DMMF: Error while trying to read datamodel path
      Details: The "path" argument must be of type string or an instance of Buffer or URL. Received undefined

      Prisma CLI Version : 0.0.0
    `)
  })

  it('db push', async () => {
    await expect(DbPush.new().parse([])).rejects.toMatchInlineSnapshot(
      `Couldn't find a datasource in the schema.prisma file`,
    )
  })

  it('db pull', async () => {
    await expect(DbPull.new().parse([])).rejects.toMatchInlineSnapshot(`
      There is no datasource in the schema.

    `)
  })

  it('db execute', async () => {
    const sqlScript = `-- Drop & Create & Drop
DROP TABLE IF EXISTS 'test-dbexecute';
CREATE TABLE 'test-dbexecute' ("id" INTEGER PRIMARY KEY);
DROP TABLE 'test-dbexecute';`

    fs.writeFileSync('script.sql', sqlScript)

    await expect(DbExecute.new().parse(['--file=./script.sql'])).rejects.toMatchInlineSnapshot(`
      There is no datasource in the schema.


    `)
  })

  it('format', async () => {
    await expect(Format.new().parse([])).rejects.toMatchInlineSnapshot(`
      Get DMMF: Error while trying to read datamodel path
      Details: The "path" argument must be of type string or an instance of Buffer or URL. Received undefined

      Prisma CLI Version : 0.0.0
    `)
  })

  it('migrate reset', async () => {
    await expect(MigrateReset.new().parse([])).rejects.toMatchInlineSnapshot(
      `Couldn't find a datasource in the schema.prisma file`,
    )
  })

  it('migrate dev', async () => {
    await expect(MigrateDev.new().parse([])).rejects.toMatchInlineSnapshot(`
      Get DMMF: Error while trying to read datamodel path
      Details: The "path" argument must be of type string or an instance of Buffer or URL. Received undefined

      Prisma CLI Version : 0.0.0
    `)
  })
})

describeIf(process.env.PRISMA_CLI_QUERY_ENGINE_TYPE === 'binary')('empty-schema binary', () => {
  beforeEach(() => {
    ctx.fixture('empty-schema/prisma')
  })

  it('validate', async () => {
    const result = await Validate.new().parse([])
    expect(result).toMatch(/^The schema at (.*) is valid 🚀$/)
  })

  it('db push', async () => {
    await expect(DbPush.new().parse([])).rejects.toMatchInlineSnapshot(
      `Couldn't find a datasource in the schema.prisma file`,
    )
  })

  it('db pull', async () => {
    await expect(DbPull.new().parse([])).rejects.toMatchInlineSnapshot(`
      There is no datasource in the schema.

    `)
  })

  it('db execute', async () => {
    const sqlScript = `-- Drop & Create & Drop
DROP TABLE IF EXISTS 'test-dbexecute';
CREATE TABLE 'test-dbexecute' ("id" INTEGER PRIMARY KEY);
DROP TABLE 'test-dbexecute';`

    fs.writeFileSync('script.sql', sqlScript)

    await expect(DbExecute.new().parse(['--file=./script.sql'])).rejects.toMatchInlineSnapshot(`
      There is no datasource in the schema.


    `)
  })

  it('format', async () => {
    const result = await Format.new().parse([])
    expect(result).toMatch(/^Formatted (.*) in \d+ms 🚀$/)
  })

  it('migrate reset', async () => {
    await expect(MigrateReset.new().parse([])).rejects.toMatchInlineSnapshot(
      `Couldn't find a datasource in the schema.prisma file`,
    )
  })

  it('migrate dev', async () => {
    await expect(MigrateDev.new().parse([])).rejects.toMatchInlineSnapshot(
      `Couldn't find a datasource in the schema.prisma file`,
    )
  })
})
