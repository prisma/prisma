import path from 'path'
import { stripVTControlCharacters } from 'util'

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

async function testSchemaPath({
  fixtureName,
  schemaPathFromArgs,
  schemaPathFromConfig,
}: {
  fixtureName: string
  schemaPathFromArgs?: string
  schemaPathFromConfig?: string
}) {
  const cwd = path.resolve(FIXTURE_CWD, fixtureName)

  let asyncResult: string | null | Error

  try {
    asyncResult =
      (
        await getSchemaWithPath(schemaPathFromArgs, schemaPathFromConfig, {
          cwd,
        })
      )?.schemaPath ?? null
  } catch (e) {
    asyncResult = e as Error
  }

  if (typeof asyncResult === 'string') {
    asyncResult = stripVTControlCharacters(toUnixPath(path.relative('.', asyncResult)))
  }

  if (asyncResult instanceof Error) {
    asyncResult.message = stripVTControlCharacters(toUnixPath(asyncResult.message.replace(__dirname, '.')))
  }

  return asyncResult
}

it('throws error if schema is not found', async () => {
  const res = await testSchemaPath({ fixtureName: 'no-schema' })

  expect(res).toMatchInlineSnapshot(`
    [Error: Could not find Prisma Schema that is required for this command.
    You can either provide it with \`--schema\` argument,
    set it in your Prisma Config file (e.g., \`prisma.config.ts\`),
    set it as \`prisma.schema\` in your package.json,
    or put it into the default location (\`./prisma/schema.prisma\`, or \`./schema.prisma\`.
    Checked following paths:

    schema.prisma: file not found
    prisma/schema.prisma: file not found

    See also https://pris.ly/d/prisma-schema-location]
  `)
})

it('reads from --schema args first even if package.json is provided', async () => {
  const res = await testSchemaPath({
    fixtureName: 'pkg-json-with-schema-args',
    schemaPathFromArgs: path.resolve(FIXTURE_CWD, 'pkg-json-with-schema-args', 'schema.prisma'),
  })

  expect(res).toMatchInlineSnapshot(`"src/__tests__/__fixtures__/getSchema/pkg-json-with-schema-args/schema.prisma"`)
})

it('throws if schema args path is invalid', async () => {
  const res = await testSchemaPath({
    fixtureName: 'pkg-json-with-schema-args',
    schemaPathFromArgs: path.resolve(FIXTURE_CWD, 'wrong_path'),
  })

  expect(res).toMatchInlineSnapshot(
    `[Error: Could not load \`--schema\` from provided path \`../wrong_path\`: file or directory not found]`,
  )
})

it('reads from --schema args first even if path is provided in Prisma config file (e.g., `prisma.config.ts`)', async () => {
  const res = await testSchemaPath({
    fixtureName: 'unconventional-path',
    schemaPathFromArgs: path.resolve(FIXTURE_CWD, 'unconventional-path', 'db', 'schema.prisma'),
    schemaPathFromConfig: path.resolve(FIXTURE_CWD, 'pkg-json-with-schema-args', 'schema.prisma'),
  })

  expect(res).toMatchInlineSnapshot(`"src/__tests__/__fixtures__/getSchema/unconventional-path/db/schema.prisma"`)
})

it('reads from path provided by prisma.config.ts', async () => {
  const res = await testSchemaPath({
    fixtureName: 'unconventional-path',
    schemaPathFromConfig: path.resolve(FIXTURE_CWD, 'unconventional-path', 'db', 'schema.prisma'),
  })

  expect(res).toMatchInlineSnapshot(`"src/__tests__/__fixtures__/getSchema/unconventional-path/db/schema.prisma"`)
})

it('reads from path provided by prisma.config.ts even if package.json is provided', async () => {
  const res = await testSchemaPath({
    fixtureName: 'pkg-json-with-prisma-config',
    schemaPathFromConfig: path.resolve(FIXTURE_CWD, 'pkg-json-with-prisma-config', 'config', 'schema.prisma'),
  })

  expect(res).toMatchInlineSnapshot(
    `"src/__tests__/__fixtures__/getSchema/pkg-json-with-prisma-config/config/schema.prisma"`,
  )
})

it('reads from directory provided by prisma.config.ts', async () => {
  const res = await testSchemaPath({
    fixtureName: 'unconventional-path-folder',
    schemaPathFromConfig: path.resolve(FIXTURE_CWD, 'unconventional-path-folder', 'db'),
  })

  expect(res).toMatchInlineSnapshot(`"src/__tests__/__fixtures__/getSchema/unconventional-path-folder/db"`)
})

it('throws error if prisma.config.ts with single file is used but schema file cannot be found', async () => {
  const res = await testSchemaPath({
    fixtureName: 'no-schema',
    schemaPathFromConfig: path.resolve(FIXTURE_CWD, 'no-schema', 'db', 'schema.prisma'),
  })

  expect(res).toMatchInlineSnapshot(
    `[Error: Could not load schema from \`./__fixtures__/getSchema/no-schema/db/schema.prisma\` provided by "prisma.config.ts"\`: file or directory not found]`,
  )
})

it('throws error if prisma.config.ts with folder is used but schema files cannot be found', async () => {
  const res = await testSchemaPath({
    fixtureName: 'no-schema',
    schemaPathFromConfig: path.resolve(FIXTURE_CWD, 'no-schema', 'db'),
  })

  expect(res).toMatchInlineSnapshot(
    `[Error: Could not load schema from \`./__fixtures__/getSchema/no-schema/db\` provided by "prisma.config.ts"\`: file or directory not found]`,
  )
})

it('reads relative schema path from the nearest package.json', async () => {
  const res = await testSchemaPath({ fixtureName: 'pkg-json-valid-relative-path' })

  expect(res).toMatchInlineSnapshot(
    `"src/__tests__/__fixtures__/getSchema/pkg-json-valid-relative-path/db/schema.prisma"`,
  )
})

it('reads schema path from the nearest package.json and throws if path does not exist', async () => {
  const res = await testSchemaPath({ fixtureName: 'pkg-json-invalid-path' })

  expect(res).toMatchInlineSnapshot(
    `[Error: Could not load schema from \`wrong-path\` provided by "prisma.schema" config of \`package.json\`: file or directory not found]`,
  )
})

it('reads schema path from the nearest package.json and throws if path is not of type string', async () => {
  const res = await testSchemaPath({ fixtureName: 'pkg-json-invalid-path-not-string' })

  expect(res).toMatchInlineSnapshot(
    `[Error: Provided schema path \`123\` from \`package.json\` must be of type string]`,
  )
})

it('reads from the nearest package.json of the cwd', async () => {
  const res = await testSchemaPath({ fixtureName: 'pkg-json-nearest/packages/a' })

  expect(res).toMatchInlineSnapshot(
    `"src/__tests__/__fixtures__/getSchema/pkg-json-nearest/packages/a/db/schema.prisma"`,
  )
})

it('finds the conventional prisma/schema path without configuration', async () => {
  const res = await testSchemaPath({ fixtureName: 'conventional-path' })

  expect(res).toMatchInlineSnapshot(`"src/__tests__/__fixtures__/getSchema/conventional-path/prisma/schema.prisma"`)
})

it('fails with no schema in workspaces', async () => {
  const res = await testSchemaPath({ fixtureName: 'no-schema-workspaces' })

  expect(res).toMatchInlineSnapshot(`
    [Error: Could not find Prisma Schema that is required for this command.
    You can either provide it with \`--schema\` argument,
    set it in your Prisma Config file (e.g., \`prisma.config.ts\`),
    set it as \`prisma.schema\` in your package.json,
    or put it into the default location (\`./prisma/schema.prisma\`, or \`./schema.prisma\`.
    Checked following paths:

    schema.prisma: file not found
    prisma/schema.prisma: file not found

    See also https://pris.ly/d/prisma-schema-location]
  `)
})
