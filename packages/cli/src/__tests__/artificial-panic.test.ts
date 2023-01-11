import { isRustPanic, jestConsoleContext, jestContext } from '@prisma/internals'
import { DbPull } from '@prisma/migrate'

import { Format } from '../Format'
import { Validate } from '../Validate'

const ctx = jestContext
  .new()
  // .add(jestConsoleContext())
  .assemble()

// @ts-ignore
const describeIf = (condition: boolean) => (condition ? describe : describe.skip)

describe('artificial-panic introspection', () => {
  // backup env vars
  const OLD_ENV = { ...process.env }

  afterEach(() => {
    // reset env vars to backup state
    process.env = { ...OLD_ENV }
  })

  it('migration-engine', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(6)
    process.env.FORCE_PANIC_MIGRATION_ENGINE = '1'

    const command = new DbPull()
    try {
      await command.parse(['--print'])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`
        Error in migration engine.
        Reason: [/some/rust/path:0:0] This is the debugPanic artificial panic

        Please create an issue with your \`schema.prisma\` at
        https://github.com/prisma/prisma/issues/new

      `)
      expect(isRustPanic(e)).toBe(true)
      expect(e.rustStack).toBeTruthy()
      expect(e.schemaPath).toBeTruthy()
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

      `),
        expect(e).toMatchObject({
          area: 'LIFT_CLI',
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
      expect(e).toMatchInlineSnapshot(`unreachable`)
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

describe('artificial-panic get-config', () => {
  const OLD_ENV = { ...process.env }

  afterEach(() => {
    process.env = { ...OLD_ENV }
  })

  it('get-config', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(5)
    process.env.FORCE_PANIC_QUERY_ENGINE_GET_CONFIG = '1'

    const command = new Validate()
    try {
      await command.parse([])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`unreachable`)
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
})

describeIf(process.env.PRISMA_CLI_QUERY_ENGINE_TYPE == 'library')('artificial-panic library', () => {
  const OLD_ENV = { ...process.env }

  afterEach(() => {
    process.env = { ...OLD_ENV }
  })

  it('query-engine get-dmmf library - validate', async () => {
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

  it('query-engine get-dmmf library - format', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(5)
    process.env.FORCE_PANIC_QUERY_ENGINE_GET_DMMF = '1'

    const command = new Format()
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
})

describeIf(process.env.PRISMA_CLI_QUERY_ENGINE_TYPE == 'binary')('artificial-panic binary', () => {
  const OLD_ENV = { ...process.env }

  afterEach(() => {
    process.env = { ...OLD_ENV }
  })

  it('query-engine get-dmmf binary - validate', async () => {
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

  it('query-engine get-dmmf binary - format', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(5)
    process.env.FORCE_PANIC_QUERY_ENGINE_GET_DMMF = '1'

    const command = new Format()
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
})
