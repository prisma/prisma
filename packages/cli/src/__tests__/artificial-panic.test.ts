import { DbPull } from '@prisma/migrate'
import { jestConsoleContext, jestContext } from '@prisma/sdk'

import { Format } from '../Format'
import { Validate } from '../Validate'

const ctx = jestContext
  .new()
  // .add(jestConsoleContext())
  .assemble()

describe('artificial-panic', () => {
  const OLD_ENV = { ...process.env }

  afterEach(() => {
    process.env = { ...OLD_ENV }
  })

  // TODO: this either fails with:
  //
  // Could not find query-engine binary. Searched in:
  //   - /node_modules/.pnpm/@prisma+engines@3.13.0-11.07815b335736eb128666b4a5a86e94e19656f4ff/node_modules/@prisma/engines/query-engine-TEST_PLATFORM
  //   - /sdk/query-engine-TEST_PLATFORM
  //   - /query-engine-TEST_PLATFORM
  //   - /sdk/runtime/query-engine-TEST_PLATFORM
  //
  // or with:
  //
  // Could not find a schema.prisma file that is required for this command.
  //
  // You can either provide it with --schema, set it as `prisma.schema` in your package.json or
  // put it into the default location ./prisma/schema.prisma https://pris.ly/d/prisma-schema-location
  it.skip('introspection-engine binary', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(1)
    process.env.PRISMA_CLI_QUERY_ENGINE_TYPE = 'binary'
    process.env.FORCE_PANIC_INTROSPECTION_ENGINE = '1'

    const command = new DbPull()
    try {
      await command.parse(['--print'])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`[/some/rust/path:0:0] This is the debugPanic artificial panic`)
    }
  })

  it('introspection-engine library', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(3)
    process.env.PRISMA_CLI_QUERY_ENGINE_TYPE = 'library'
    process.env.FORCE_PANIC_INTROSPECTION_ENGINE = '1'

    const command = new DbPull()
    try {
      await command.parse(['--print'])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`[/some/rust/path:0:0] This is the debugPanic artificial panic`)
      expect(e.rustStack).toBeTruthy()
      expect(e).toMatchObject({
        area: 'INTROSPECTION_CLI',
        schemaPath: undefined,
        schema: `// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = \"prisma-client-js\"
}

datasource db {
  provider = \"postgresql\"
  url      = env(\"DATABASE_URL\")
}
`,
      })
    }
  })

  it('formatter binary', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(4)
    process.env.PRISMA_CLI_QUERY_ENGINE_TYPE = 'binary'
    process.env.FORCE_PANIC_PRISMA_FMT = '1'

    const command = new Format()
    try {
      const output = await command.parse([])
      console.log('output', output)
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`Command failed with exit code 101: prisma-engines-path debug-panic`)
      expect(e.rustStack).toBeTruthy()
      expect(e.schemaPath).toContain('prisma/schema.prisma')
      expect(e).toMatchObject({
        schema: undefined,
      })
    }
  })

  it('formatter library', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(4)
    process.env.PRISMA_CLI_QUERY_ENGINE_TYPE = 'library'
    process.env.FORCE_PANIC_PRISMA_FMT = '1'

    const command = new Format()
    try {
      await command.parse([])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`Command failed with exit code 101: prisma-engines-path debug-panic`)
      expect(e.rustStack).toBeTruthy()
      expect(e.schemaPath).toContain('prisma/schema.prisma')
      expect(e).toMatchObject({
        schema: undefined,
      })
    }
  })

  // TODO: currently it fails with:
  //
  // Schema parsing
  // error: Found argument 'debug-panic' which wasn't expected, or isn't valid in this context
  it.skip('query-engine get-dmmf binary', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(4)
    process.env.PRISMA_CLI_QUERY_ENGINE_TYPE = 'binary'
    process.env.FORCE_PANIC_QUERY_ENGINE_GET_DMMF = '1'

    const command = new Validate()
    try {
      await command.parse([])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(``)
      expect(e.rustStack).toBeTruthy()
      expect(e.schemaPath).toContain('prisma/schema.prisma')
      expect(e).toMatchObject({
        schema: undefined,
      })
    }
  })

  // TODO: currently it fails with:
  //
  // Schema parsing
  // error: Found argument 'debug-panic' which wasn't expected, or isn't valid in this context
  it('query-engine get-dmmf library', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(4)
    process.env.PRISMA_CLI_QUERY_ENGINE_TYPE = 'library'
    process.env.FORCE_PANIC_QUERY_ENGINE_GET_DMMF = '1'

    const command = new Validate()
    try {
      await command.parse([])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`Schema parsing
      FORCE_PANIC_QUERY_ENGINE_GET_DMMF`)
      expect(e.rustStack).toBeTruthy()
      expect(e.schemaPath).toContain('prisma/schema.prisma')
      expect(e).toMatchObject({
        schema: undefined,
      })
    }
  })

  // TODO: currently it fails with:
  //
  // Get config: error: Found argument 'debug-panic' which wasn't expected, or isn't valid in this context
  it.skip('query-engine get-config binary', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(4)
    process.env.PRISMA_CLI_QUERY_ENGINE_TYPE = 'binary'
    process.env.FORCE_PANIC_QUERY_ENGINE_GET_CONFIG = '1'

    const command = new Validate()
    try {
      await command.parse([])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(``)
      expect(e.rustStack).toBeTruthy()
      expect(e.schemaPath).toContain('prisma/schema.prisma')
      expect(e).toMatchObject({
        schema: undefined,
      })
    }
  })

  it('query-engine get-config library', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(4)
    process.env.PRISMA_CLI_QUERY_ENGINE_TYPE = 'library'
    process.env.FORCE_PANIC_QUERY_ENGINE_GET_CONFIG = '1'

    const command = new Validate()
    try {
      await command.parse([])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`Get config: undefined

[object Object]`)
      expect(e.rustStack).toBeTruthy()
      expect(e.schemaPath).toContain('prisma/schema.prisma')
      expect(e).toMatchObject({
        schema: undefined,
      })
    }
  })
})
