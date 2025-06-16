import { defineConfig, PrismaConfigInternal } from '@prisma/config'
import { inferDirectoryConfig, loadSchemaContext } from '@prisma/internals'
import path from 'path'

import { fixturesPath } from './__utils__/fixtures'

const FIXTURE_CWD = path.resolve(fixturesPath, 'directoryConfig')

async function testDirectoryConfig({
  fixtureName,
  schemaPath,
  config,
}: {
  fixtureName: string
  schemaPath?: string
  config?: PrismaConfigInternal
}) {
  const cwd = path.resolve(FIXTURE_CWD, fixtureName)

  const schemaContext = await loadSchemaContext({ schemaPathFromArg: schemaPath, cwd, allowNull: true })
  return inferDirectoryConfig(schemaContext, config, cwd)
}
it('places folders next to single schema file', async () => {
  const res = await testDirectoryConfig({ fixtureName: 'single-schema-file' })

  expect(res).toEqual({
    migrationsDirPath: path.resolve(FIXTURE_CWD, 'single-schema-file', 'prisma', 'migrations'),
    typedSqlDirPath: path.resolve(FIXTURE_CWD, 'single-schema-file', 'prisma', 'sql'),
    viewsDirPath: path.resolve(FIXTURE_CWD, 'single-schema-file', 'prisma', 'views'),
  })
})

it('places folders next to schema file with the datasource block - multiple schema files', async () => {
  const res = await testDirectoryConfig({ fixtureName: 'multiple-schema-files', schemaPath: './prisma' })

  expect(res).toEqual({
    migrationsDirPath: path.resolve(FIXTURE_CWD, 'multiple-schema-files', 'prisma', 'migrations'),
    typedSqlDirPath: path.resolve(FIXTURE_CWD, 'multiple-schema-files', 'prisma', 'sql'),
    viewsDirPath: path.resolve(FIXTURE_CWD, 'multiple-schema-files', 'prisma', 'views'),
  })
})

it('places folders next to schema file with the datasource block - multiple schema files across custom directories', async () => {
  const res = await testDirectoryConfig({ fixtureName: 'tree-structure-schema-files', schemaPath: './prisma-custom' })

  expect(res).toEqual({
    migrationsDirPath: path.resolve(FIXTURE_CWD, 'tree-structure-schema-files', 'prisma-custom', 'migrations'),
    typedSqlDirPath: path.resolve(FIXTURE_CWD, 'tree-structure-schema-files', 'prisma-custom', 'sql'),
    viewsDirPath: path.resolve(FIXTURE_CWD, 'tree-structure-schema-files', 'prisma-custom', 'views'),
  })
})

it('places folders next to schema file with the datasource block - datasource schema file is in subfolder', async () => {
  const res = await testDirectoryConfig({ fixtureName: 'nested-datasource-schema-file', schemaPath: './prisma' })

  expect(res).toEqual({
    migrationsDirPath: path.resolve(FIXTURE_CWD, 'nested-datasource-schema-file', 'prisma', 'datasource', 'migrations'),
    typedSqlDirPath: path.resolve(FIXTURE_CWD, 'nested-datasource-schema-file', 'prisma', 'datasource', 'sql'),
    viewsDirPath: path.resolve(FIXTURE_CWD, 'nested-datasource-schema-file', 'prisma', 'datasource', 'views'),
  })
})

it('places folders into schema path directory if no datasource block found and directory schema path given', async () => {
  const res = await testDirectoryConfig({
    fixtureName: 'no-datasource-schema-file',
    schemaPath: './prisma',
  })

  expect(res).toEqual({
    migrationsDirPath: path.resolve(FIXTURE_CWD, 'no-datasource-schema-file', 'prisma', 'migrations'),
    typedSqlDirPath: path.resolve(FIXTURE_CWD, 'no-datasource-schema-file', 'prisma', 'sql'),
    viewsDirPath: path.resolve(FIXTURE_CWD, 'no-datasource-schema-file', 'prisma', 'views'),
  })
})

it('places folders next to schema file if no datasource block found and file schema path given', async () => {
  const res = await testDirectoryConfig({
    fixtureName: 'no-datasource-schema-file',
    schemaPath: './prisma/custom/schema.prisma',
  })

  expect(res).toEqual({
    migrationsDirPath: path.resolve(FIXTURE_CWD, 'no-datasource-schema-file', 'prisma', 'custom', 'migrations'),
    typedSqlDirPath: path.resolve(FIXTURE_CWD, 'no-datasource-schema-file', 'prisma', 'custom', 'sql'),
    viewsDirPath: path.resolve(FIXTURE_CWD, 'no-datasource-schema-file', 'prisma', 'custom', 'views'),
  })
})

it('places folders to /prisma if no schema file present', async () => {
  const res = await testDirectoryConfig({ fixtureName: 'no-schema-file' })

  expect(res).toEqual({
    migrationsDirPath: path.resolve(FIXTURE_CWD, 'no-schema-file', 'prisma', 'migrations'),
    typedSqlDirPath: path.resolve(FIXTURE_CWD, 'no-schema-file', 'prisma', 'sql'),
    viewsDirPath: path.resolve(FIXTURE_CWD, 'no-schema-file', 'prisma', 'views'),
  })
})

it('uses migrationsDirectory from config if given', async () => {
  const res = await testDirectoryConfig({
    fixtureName: 'single-schema-file',
    config: defineConfig({
      earlyAccess: true,
      migrate: {
        migrationsDirectory: path.resolve(FIXTURE_CWD, 'custom', 'migrations'),
      },
    }),
  })

  expect(res).toEqual({
    migrationsDirPath: path.resolve(FIXTURE_CWD, 'custom', 'migrations'),
    typedSqlDirPath: path.resolve(FIXTURE_CWD, 'single-schema-file', 'prisma', 'sql'),
    viewsDirPath: path.resolve(FIXTURE_CWD, 'single-schema-file', 'prisma', 'views'),
  })
})
