import path from 'path'
import stripAnsi from 'strip-ansi'

import { getSchemaWithPath } from '../cli/getSchema'
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

  let asyncResult: string | null | Error

  try {
    asyncResult =
      (
        await getSchemaWithPath(schemaPathFromArgs, {
          cwd,
        })
      )?.schemaPath ?? null
  } catch (e) {
    asyncResult = e as Error
  }

  if (typeof asyncResult === 'string') {
    asyncResult = stripAnsi(toUnixPath(path.relative('.', asyncResult)))
  }

  if (asyncResult instanceof Error) {
    asyncResult.message = stripAnsi(toUnixPath(asyncResult.message.replace(__dirname, '.')))
  }

  return asyncResult
}

it('throws error if schema is not found', async () => {
  const res = await testSchemaPath('no-schema')

  expect(res).toMatchInlineSnapshot(`
    [Error: Could not find Prisma Schema that is required for this command.
    You can either provide it with \`--schema\` argument, set it as \`prisma.schema\` in your package.json or put it into the default location.
    Checked following paths:

    schema.prisma: file not found
    prisma/schema.prisma: file not found
    prisma/schema: directory not found

    See also https://pris.ly/d/prisma-schema-location]
  `)
})

it('reads from --schema args first even if package.json is provided', async () => {
  const res = await testSchemaPath(
    'pkg-json-with-schema-args',
    path.resolve(FIXTURE_CWD, 'pkg-json-with-schema-args', 'schema.prisma'),
  )

  expect(res).toMatchInlineSnapshot(`"src/__tests__/__fixtures__/getSchema/pkg-json-with-schema-args/schema.prisma"`)
})

it('throws if schema args path is invalid', async () => {
  const res = await testSchemaPath('pkg-json-with-schema-args', path.resolve(FIXTURE_CWD, 'wrong_path'))

  expect(res).toMatchInlineSnapshot(
    `[Error: Could not load \`--schema\` from provided path \`../wrong_path\`: file or directory not found]`,
  )
})

it('reads relative schema path from the nearest package.json', async () => {
  const res = await testSchemaPath('pkg-json-valid-relative-path')

  expect(res).toMatchInlineSnapshot(
    `"src/__tests__/__fixtures__/getSchema/pkg-json-valid-relative-path/db/schema.prisma"`,
  )
})

it('reads schema path from the nearest package.json and throws if path does not exist', async () => {
  const res = await testSchemaPath('pkg-json-invalid-path')

  expect(res).toMatchInlineSnapshot(
    `[Error: Could not load schema from \`wrong-path\` provided by "prisma.schema" config of \`package.json\`: file or directory not found]`,
  )
})

it('reads schema path from the nearest package.json and throws if path is not of type string', async () => {
  const res = await testSchemaPath('pkg-json-invalid-path-not-string')

  expect(res).toMatchInlineSnapshot(
    `[Error: Provided schema path \`123\` from \`package.json\` must be of type string]`,
  )
})

it('reads from the nearest package.json of the cwd', async () => {
  const res = await testSchemaPath('pkg-json-nearest/packages/a')

  expect(res).toMatchInlineSnapshot(
    `"src/__tests__/__fixtures__/getSchema/pkg-json-nearest/packages/a/db/schema.prisma"`,
  )
})

it('finds the conventional prisma/schema path without configuration', async () => {
  const res = await testSchemaPath('conventional-path')

  expect(res).toMatchInlineSnapshot(`"src/__tests__/__fixtures__/getSchema/conventional-path/prisma/schema.prisma"`)
})

it('throws error if both schema file and folder exist at default locations', async () => {
  const res = await testSchemaPath('conventional-path-file-dir-conflict')

  expect(res).toMatchInlineSnapshot(
    `[Error: Found Prisma Schemas at both \`prisma/schema.prisma\` and \`prisma/schema\`. Please remove one.]`,
  )
})

it('throws error if folder schema exists, but preview feature is not on', async () => {
  const res = await testSchemaPath('no-schema-no-folder-preview')

  expect(res).toMatchInlineSnapshot(`
    [Error: Could not find Prisma Schema that is required for this command.
    You can either provide it with \`--schema\` argument, set it as \`prisma.schema\` in your package.json or put it into the default location.
    Checked following paths:

    schema.prisma: file not found
    prisma/schema.prisma: file not found
    prisma/schema: "prismaSchemaFolder" preview feature must be enabled

    See also https://pris.ly/d/prisma-schema-location]
  `)
})

it('throws error if explicit --schema arg is used and preview feature is not on', async () => {
  const res = await testSchemaPath('no-schema-no-folder-preview', './prisma/schema')

  expect(res).toMatchInlineSnapshot(
    `[Error: Could not load \`--schema\` from provided path \`prisma/schema\`: "prismaSchemaFolder" preview feature must be enabled]`,
  )
})

it('finds the schema path in the root package.json of a yarn workspace from a child package', async () => {
  const res = await testSchemaPath('pkg-json-workspace-parent/packages/a')

  expect(res).toMatchInlineSnapshot(`"src/__tests__/__fixtures__/getSchema/pkg-json-workspace-parent/db/schema.prisma"`)
})

it('finds the conventional schema path with yarn workspaces', async () => {
  const res = await testSchemaPath('conventional-path-workspaces')

  expect(res).toMatchInlineSnapshot(
    `"src/__tests__/__fixtures__/getSchema/conventional-path-workspaces/packages/b/schema.prisma"`,
  )
})

it('fails with no schema in workspaces', async () => {
  const res = await testSchemaPath('no-schema-workspaces')

  expect(res).toMatchInlineSnapshot(`
    [Error: Could not find Prisma Schema that is required for this command.
    You can either provide it with \`--schema\` argument, set it as \`prisma.schema\` in your package.json or put it into the default location.
    Checked following paths:

    schema.prisma: file not found
    prisma/schema.prisma: file not found
    prisma/schema: directory not found
    packages/a/schema.prisma: file not found
    packages/a/prisma/schema.prisma: file not found
    packages/a/prisma/schema: directory not found
    packages/b/schema.prisma: file not found
    packages/b/prisma/schema.prisma: file not found
    packages/b/prisma/schema: directory not found

    See also https://pris.ly/d/prisma-schema-location]
  `)
})
