import { DbPull } from '@prisma/migrate'
import { isRustPanic, jestConsoleContext, jestContext } from '@prisma/sdk'

import { Format } from '../Format'
import { Validate } from '../Validate'

const ctx = jestContext
  .new()
  // .add(jestConsoleContext())
  .assemble()

// @ts-ignore
const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

describe('artificial-panic introspection', () => {
  const OLD_ENV = { ...process.env }

  afterEach(() => {
    process.env = { ...OLD_ENV }
  })

  it('introspection-engine', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(4)
    process.env.FORCE_PANIC_INTROSPECTION_ENGINE = '1'

    const command = new DbPull()
    try {
      await command.parse(['--print'])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`[/some/rust/path:0:0] This is the debugPanic artificial panic`)
      expect(isRustPanic(e)).toBe(true)
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
`.replace(/\r\n/g, '\n'), // replace due to Windows CI
      })
    }
  })
})

describe('artificial-panic formatter', () => {
  const OLD_ENV = { ...process.env }

  afterEach(() => {
    process.env = { ...OLD_ENV }
  })

  it('formatter', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(5)
    process.env.FORCE_PANIC_PRISMA_FMT = '1'

    const command = new Format()
    try {
      await command.parse([])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`Command failed with exit code 101: prisma-engines-path debug-panic`)
      expect(isRustPanic(e)).toBe(true)
      expect(e.rustStack).toBeTruthy()
      expect(e.schemaPath.replace(/\\/g, '/')) // replace due to Windows CI
        .toContain('prisma/schema.prisma')
      expect(e).toMatchObject({
        schema: undefined,
      })
    }
  })
})

describeIf(process.env.PRISMA_CLI_QUERY_ENGINE_TYPE == 'library')('artificial-panic library', () => {
  const OLD_ENV = { ...process.env }

  afterEach(() => {
    process.env = { ...OLD_ENV }
  })

  it('query-engine get-dmmf library', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(5)
    process.env.FORCE_PANIC_QUERY_ENGINE_GET_DMMF = '1'

    const command = new Validate()
    try {
      await command.parse([])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`FORCE_PANIC_QUERY_ENGINE_GET_DMMF`)
      expect(isRustPanic(e)).toBe(true)
      expect(e.rustStack).toBeTruthy()
      expect(e.schema).toMatchInlineSnapshot(`
        // This is your Prisma schema file,
        // learn more about it in the docs: https://pris.ly/d/prisma-schema

        generator client {
          provider = "prisma-client-js"
        }

        datasource db {
          provider = "postgresql"
          url      = env("DATABASE_URL")
        }

      `)
      expect(e).toMatchObject({
        schemaPath: undefined,
      })
    }
  })

  it('query-engine get-config library', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(4)
    process.env.FORCE_PANIC_QUERY_ENGINE_GET_CONFIG = '1'

    const command = new Validate()
    try {
      await command.parse([])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`FORCE_PANIC_QUERY_ENGINE_GET_CONFIG`)
      expect(isRustPanic(e)).toBe(true)
      expect(e.rustStack).toBeTruthy()
      expect(e).toMatchObject({
        schemaPath: undefined,
        schema: undefined,
      })
    }
  })
})

describeIf(process.env.PRISMA_CLI_QUERY_ENGINE_TYPE == 'binary')('artificial-panic binary', () => {
  const OLD_ENV = { ...process.env }

  afterEach(() => {
    process.env = { ...OLD_ENV }
  })

  it('query-engine get-dmmf binary', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(5)
    process.env.FORCE_PANIC_QUERY_ENGINE_GET_DMMF = '1'

    const command = new Validate()
    try {
      await command.parse([])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(
        `Command failed with exit code 101: prisma-engines-path FORCE_PANIC_QUERY_ENGINE_GET_DMMF`,
      )
      expect(isRustPanic(e)).toBe(true)
      expect(e.rustStack).toBeTruthy()
      expect(e.schemaPath).toBeTruthy()
      expect(e).toMatchObject({
        schema: undefined,
      })
    }
  })

  it('query-engine get-config binary', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(5)
    process.env.FORCE_PANIC_QUERY_ENGINE_GET_CONFIG = '1'

    const command = new Validate()
    try {
      await command.parse([])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(
        `Command failed with exit code 101: prisma-engines-path FORCE_PANIC_QUERY_ENGINE_GET_CONFIG`,
      )
      expect(isRustPanic(e)).toBe(true)
      expect(e.rustStack).toBeTruthy()
      expect(e.schemaPath).toBeTruthy()
      expect(e).toMatchObject({
        schema: undefined,
      })
    }
  })
})
