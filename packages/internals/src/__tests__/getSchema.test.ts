import path from 'path'

import { getSchemaPathInternal, getSchemaPathSyncInternal } from '../cli/getSchema'
import { fixturesPath } from './__utils__/fixtures'

if (process.env.CI) {
  // 5s is often not enough for the "finds the schema path in the root
  // package.json of a yarn workspace from a child package" test on macOS CI.
  jest.setTimeout(60_000)
}

process.env.npm_config_user_agent = 'yarn/1.22.4 npm/? node/v12.18.3 darwin x64'

const FIXTURE_CWD = path.resolve(fixturesPath, 'getSchema')

function toUnixPath(path: string) {
  return path.replace(/\\/g, '/')
}

async function testSchemaPath(fixtureName: string, schemaPathFromArgs?: string) {
  const cwd = path.resolve(FIXTURE_CWD, fixtureName)

  let syncResult: string | null | Error
  let asyncResult: string | null | Error

  try {
    syncResult = getSchemaPathSyncInternal(schemaPathFromArgs, {
      cwd,
    })
  } catch (e) {
    syncResult = e as Error
  }

  try {
    asyncResult = await getSchemaPathInternal(schemaPathFromArgs, {
      cwd,
    })
  } catch (e) {
    asyncResult = e as Error
  }

  /**
   * Make paths relatives to enable snapshot testing on any machines
   */
  if (typeof syncResult === 'string') {
    syncResult = toUnixPath(path.relative('.', syncResult))
  }

  if (typeof asyncResult === 'string') {
    asyncResult = toUnixPath(path.relative('.', asyncResult))
  }

  if (syncResult instanceof Error) {
    syncResult.message = toUnixPath(syncResult.message.replace(__dirname, '.'))
  }

  if (asyncResult instanceof Error) {
    asyncResult.message = toUnixPath(asyncResult.message.replace(__dirname, '.'))
  }

  return {
    sync: syncResult,
    async: asyncResult,
  }
}

it('returns null if no schema is found', async () => {
  const res = await testSchemaPath('no-schema')

  expect(res).toMatchInlineSnapshot(`
    {
      "async": null,
      "sync": null,
    }
  `)
})

it('reads from --schema args first even if package.json is provided', async () => {
  const res = await testSchemaPath(
    'pkg-json-with-schema-args',
    path.resolve(FIXTURE_CWD, 'pkg-json-with-schema-args', 'schema.prisma'),
  )

  expect(res).toMatchInlineSnapshot(`
    {
      "async": "src/__tests__/__fixtures__/getSchema/pkg-json-with-schema-args/schema.prisma",
      "sync": "src/__tests__/__fixtures__/getSchema/pkg-json-with-schema-args/schema.prisma",
    }
  `)
})

it('throws if schema args path is invalid', async () => {
  const res = await testSchemaPath('pkg-json-with-schema-args', path.resolve(FIXTURE_CWD, 'wrong_path'))

  expect(res).toMatchInlineSnapshot(`
    {
      "async": [Error: Provided --schema at ./__fixtures__/getSchema/wrong_path doesn't exist.],
      "sync": [Error: Provided --schema at ./__fixtures__/getSchema/wrong_path doesn't exist.],
    }
  `)
})

it('reads relative schema path from the nearest package.json', async () => {
  const res = await testSchemaPath('pkg-json-valid-relative-path')

  expect(res).toMatchInlineSnapshot(`
    {
      "async": "src/__tests__/__fixtures__/getSchema/pkg-json-valid-relative-path/db/schema.prisma",
      "sync": "src/__tests__/__fixtures__/getSchema/pkg-json-valid-relative-path/db/schema.prisma",
    }
  `)
})

it('reads schema path from the nearest package.json and throws if path does not exist', async () => {
  const res = await testSchemaPath('pkg-json-invalid-path')

  expect(res).toMatchInlineSnapshot(`
    {
      "async": [Error: Provided schema path \`wrong-path\` from \`package.json\` doesn't exist.],
      "sync": [Error: Provided schema path \`wrong-path\` from \`package.json\` doesn't exist.],
    }
  `)
})

it('reads schema path from the nearest package.json and throws if path is not of type string', async () => {
  const res = await testSchemaPath('pkg-json-invalid-path-not-string')

  expect(res).toMatchInlineSnapshot(`
    {
      "async": [Error: Provided schema path \`123\` from \`package.json\` must be of type string],
      "sync": [Error: Provided schema path \`123\` from \`package.json\` must be of type string],
    }
  `)
})

it('reads from the nearest package.json of the cwd', async () => {
  const res = await testSchemaPath('pkg-json-nearest/packages/a')

  expect(res).toMatchInlineSnapshot(`
    {
      "async": "src/__tests__/__fixtures__/getSchema/pkg-json-nearest/packages/a/db/schema.prisma",
      "sync": "src/__tests__/__fixtures__/getSchema/pkg-json-nearest/packages/a/db/schema.prisma",
    }
  `)
})

it('finds the conventional prisma/schema path without configuration', async () => {
  const res = await testSchemaPath('conventional-path')

  expect(res).toMatchInlineSnapshot(`
    {
      "async": "src/__tests__/__fixtures__/getSchema/conventional-path/prisma/schema.prisma",
      "sync": "src/__tests__/__fixtures__/getSchema/conventional-path/prisma/schema.prisma",
    }
  `)
})

it('finds the schema path in the root package.json of a yarn workspace from a child package', async () => {
  const res = await testSchemaPath('pkg-json-workspace-parent/packages/a')

  expect(res).toMatchInlineSnapshot(`
    {
      "async": "src/__tests__/__fixtures__/getSchema/pkg-json-workspace-parent/db/schema.prisma",
      "sync": "src/__tests__/__fixtures__/getSchema/pkg-json-workspace-parent/db/schema.prisma",
    }
  `)
})

it('finds the conventional schema path with yarn workspaces', async () => {
  const res = await testSchemaPath('conventional-path-workspaces')

  expect(res).toMatchInlineSnapshot(`
    {
      "async": "src/__tests__/__fixtures__/getSchema/conventional-path-workspaces/packages/b/schema.prisma",
      "sync": "src/__tests__/__fixtures__/getSchema/conventional-path-workspaces/packages/b/schema.prisma",
    }
  `)
})
