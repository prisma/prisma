import * as fs from 'fs'
import * as path from 'path'
import {
  getSchemaPathInternal,
  getSchemaPathSyncInternal,
} from '../cli/getSchema'

const FIXTURE_CWD = path.resolve(__dirname, 'fixtures', 'getSchema')

async function testSchemaPath(
  fixtureName: string,
  schemaPathFromArgs?: string,
) {
  const cwd = path.resolve(FIXTURE_CWD, fixtureName)

  let syncResult: string | null | Error
  let asyncResult: string | null | Error

  try {
    syncResult = getSchemaPathSyncInternal(schemaPathFromArgs, {
      cwd,
    })
  } catch (e) {
    syncResult = e
  }

  try {
    asyncResult = await getSchemaPathInternal(schemaPathFromArgs, {
      cwd,
    })
  } catch (e) {
    asyncResult = e
  }

  /**
   * Make paths relatives to enable snapshot testing on any machines
   */
  if (typeof syncResult === 'string') {
    syncResult = path.relative('.', syncResult)
  }

  if (typeof asyncResult === 'string') {
    asyncResult = path.relative('.', asyncResult)
  }

  if (syncResult instanceof Error) {
    syncResult.message = syncResult.message.replace(__dirname, '.')
  }

  if (asyncResult instanceof Error) {
    asyncResult.message = asyncResult.message.replace(__dirname, '.')
  }

  return {
    sync: syncResult,
    async: asyncResult,
  }
}

it('reads from --schema args first even if package.json is provided', async () => {
  const res = await testSchemaPath(
    'pkg-json-with-schema-args',
    path.resolve(FIXTURE_CWD, 'pkg-json-with-schema-args', 'schema.prisma'),
  )

  expect(res).toMatchInlineSnapshot(`
    Object {
      "async": "src/__tests__/fixtures/getSchema/pkg-json-with-schema-args/schema.prisma",
      "sync": "src/__tests__/fixtures/getSchema/pkg-json-with-schema-args/schema.prisma",
    }
  `)
})

it('throws if schema args path is invalid', async () => {
  const res = await testSchemaPath(
    'pkg-json-with-schema-args',
    path.resolve(FIXTURE_CWD, 'wrong_path'),
  )

  expect(res).toMatchInlineSnapshot(`
    Object {
      "async": [Error: Provided --schema at ./fixtures/getSchema/wrong_path doesn't exist.],
      "sync": [Error: Provided --schema at ./fixtures/getSchema/wrong_path doesn't exist.],
    }
  `)
})

it('reads relative schema path from the nearest package.json', async () => {
  const res = await testSchemaPath('pkg-json-valid-relative-path')

  expect(res).toMatchInlineSnapshot(`
    Object {
      "async": "src/__tests__/fixtures/getSchema/pkg-json-valid-relative-path/db/schema.prisma",
      "sync": "src/__tests__/fixtures/getSchema/pkg-json-valid-relative-path/db/schema.prisma",
    }
  `)
})

it('reads schema path from the nearest package.json and throws if path does not exist', async () => {
  const res = await testSchemaPath('pkg-json-invalid-path')

  expect(res).toMatchInlineSnapshot(`
    Object {
      "async": [Error: Provided schema path at ./wrong-path from ./package.json doesn't exist.],
      "sync": [Error: Provided schema path at ./wrong-path from ./package.json doesn't exist.],
    }
  `)
})

it('reads from the nearest package.json of the cwd', async () => {
  const res = await testSchemaPath('pkg-json-nearest/packages/a')

  expect(res).toMatchInlineSnapshot(`
    Object {
      "async": "src/__tests__/fixtures/getSchema/pkg-json-nearest/packages/a/db/schema.prisma",
      "sync": "src/__tests__/fixtures/getSchema/pkg-json-nearest/packages/a/db/schema.prisma",
    }
  `)
})

it('finds the conventional prisma/schema path without configuration', async () => {
  const res = await testSchemaPath('conventional-path')

  expect(res).toMatchInlineSnapshot(`
    Object {
      "async": "src/__tests__/fixtures/getSchema/conventional-path/prisma/schema.prisma",
      "sync": "src/__tests__/fixtures/getSchema/conventional-path/prisma/schema.prisma",
    }
  `)
})

it('finds the conventional schema path using INIT_CWD as fallback', async () => {
  process.env.INIT_CWD = path.resolve(FIXTURE_CWD, 'init-cwd')

  const res = await testSchemaPath('wrong_cwd')

  delete process.env.INIT_CWD

  expect(res).toMatchInlineSnapshot(`
    Object {
      "async": "src/__tests__/fixtures/getSchema/init-cwd/schema.prisma",
      "sync": "src/__tests__/fixtures/getSchema/init-cwd/schema.prisma",
    }
  `)
})

it('finds the conventional schema path with yarn workspaces and INIT_CWD as fallback', async () => {
  process.env.INIT_CWD = path.resolve(
    FIXTURE_CWD,
    'conventional-path-workspaces',
  )
  process.env.npm_config_user_agent =
    'yarn/1.22.4 npm/? node/v12.18.3 darwin x64'

  const res = await testSchemaPath('wrong_cwd')

  delete process.env.INIT_CWD
  delete process.env.npm_config_user_agent

  expect(res).toMatchInlineSnapshot(`
    Object {
      "async": "src/__tests__/fixtures/getSchema/conventional-path-workspaces/packages/b/schema.prisma",
      "sync": "src/__tests__/fixtures/getSchema/conventional-path-workspaces/packages/b/schema.prisma",
    }
  `)
})

it('finds the package.json custom schema path with yarn workspaces and INIT_CWD as fallback', async () => {
  process.env.INIT_CWD = path.resolve(FIXTURE_CWD, 'pkg-json-workspaces')
  process.env.npm_config_user_agent =
    'yarn/1.22.4 npm/? node/v12.18.3 darwin x64'

  const res = await testSchemaPath('wrong_cwd')

  delete process.env.INIT_CWD
  delete process.env.npm_config_user_agent

  expect(res).toMatchInlineSnapshot(`
    Object {
      "async": "src/__tests__/fixtures/getSchema/pkg-json-workspaces/packages/b/db/schema.prisma",
      "sync": "src/__tests__/fixtures/getSchema/pkg-json-workspaces/packages/b/db/schema.prisma",
    }
  `)
})
