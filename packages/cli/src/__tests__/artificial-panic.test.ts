import { defaultTestConfig } from '@prisma/config'
import { jestContext } from '@prisma/get-platform'
import { serialize } from '@prisma/get-platform/src/test-utils/jestSnapshotSerializer'
import { getDMMF, isRustPanic, type MultipleSchemas, relativizePathInPSLError } from '@prisma/internals'
import { DbPull } from '@prisma/migrate'

import { Format } from '../Format'
import { Validate } from '../Validate'

const ctx = jestContext.new().assemble()

/// Normally, we use absolute paths for schema files throughout the codebase.
/// However, for tests we can't just store aboslute snapshot within the snapshot - we
/// want it to be transferable between different machines and operating systems. So, that's
/// why we are converting paths to relative before snapshoting them
function sanitizeSchemas(schemas: MultipleSchemas | undefined): MultipleSchemas | undefined {
  return schemas?.map(([path, content]) => [relativizePathInPSLError(path), content])
}

/**
 * Note: under the hood, these artificial-panic tests uses the Wasm'd `getConfig` and `getDMMF` definitions
 */

describe('artificial-panic introspection', () => {
  // backup env vars
  const OLD_ENV = { ...process.env }

  afterEach(() => {
    // reset env vars to backup state
    process.env = { ...OLD_ENV }
  })

  it('schema-engine', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(6)
    process.env.FORCE_PANIC_SCHEMA_ENGINE = '1'

    const command = new DbPull()
    try {
      await command.parse(['--print'], defaultTestConfig())
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`
        "Error in Schema engine.
        Reason: [/some/rust/path:0:0] This is the debugPanic artificial panic
        "
      `)
      expect(isRustPanic(e)).toBe(true)
      expect(e.rustStack).toBeTruthy()
      expect(e.schemaPath).toBeTruthy()
      expect(sanitizeSchemas(e.schema)).toMatchInlineSnapshot(`
        [
          [
            "prisma/schema.prisma",
            "// This is your Prisma schema file,
        // learn more about it in the docs: https://pris.ly/d/prisma-schema

        generator client {
          provider = "prisma-client-js"
        }

        datasource db {
          provider = "postgresql"
          url      = "postgres://user:password@randomhost:5432"
        }
        ",
          ],
        ]
      `)

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
    process.env.FORCE_PANIC_PRISMA_SCHEMA = '1'

    const command = new Format()
    try {
      await command.parse([], defaultTestConfig())
    } catch (e) {
      expect(serialize(e.message)).toMatchInlineSnapshot(`
        ""RuntimeError: panicked at prisma-schema-wasm/src/lib.rs:0:0:
        This is the panic triggered by \`prisma_fmt::debug_panic()\`""
      `)
      expect(isRustPanic(e)).toBe(true)
      expect(e.rustStack).toBeTruthy()
      expect(e.schemaPath.replace(/\\/g, '/')) // replace due to Windows CI
        .toContain('prisma/schema.prisma')
      expect(sanitizeSchemas(e.schema)).toMatchInlineSnapshot(`
        [
          [
            "prisma/schema.prisma",
            "// This is your Prisma schema file,
        // learn more about it in the docs: https://pris.ly/d/prisma-schema

        generator client {
          provider = "prisma-client-js"
        }

        datasource db {
          provider = "postgresql"
          url      = "postgres://user:password@randomhost:5432"
        }
        ",
          ],
        ]
      `)
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
      await command.parse([], defaultTestConfig())
    } catch (e) {
      expect(serialize(e.message)).toMatchInlineSnapshot(`
        ""RuntimeError: panicked at prisma-schema-wasm/src/lib.rs:0:0:
        This is the panic triggered by \`prisma_fmt::debug_panic()\`""
      `)
      expect(isRustPanic(e)).toBe(true)
      expect(e.rustStack).toBeTruthy()
      expect(sanitizeSchemas(e.schema)).toMatchInlineSnapshot(`
        [
          [
            "prisma/schema.prisma",
            "// This is your Prisma schema file,
        // learn more about it in the docs: https://pris.ly/d/prisma-schema

        generator client {
          provider = "prisma-client-js"
        }

        datasource db {
          provider = "postgresql"
          url      = "postgres://user:password@randomhost:5432"
        }
        ",
          ],
        ]
      `)
      expect(e).toMatchObject({
        schemaPath: undefined,
      })
    }
  })
})

describe('artificial-panic validate', () => {
  const OLD_ENV = { ...process.env }

  afterEach(() => {
    process.env = { ...OLD_ENV }
  })

  it('validate', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(5)
    process.env.FORCE_PANIC_QUERY_ENGINE_GET_DMMF = '1'

    const command = new Validate()
    try {
      await command.parse([], defaultTestConfig())
    } catch (e) {
      expect(serialize(e.message)).toMatchInlineSnapshot(`
        ""RuntimeError: panicked at prisma-schema-wasm/src/lib.rs:0:0:
        This is the panic triggered by \`prisma_fmt::debug_panic()\`""
      `)
      expect(isRustPanic(e)).toBe(true)
      expect(e.rustStack).toBeTruthy()
      expect(sanitizeSchemas(e.schema)).toMatchInlineSnapshot(`
        [
          [
            "prisma/schema.prisma",
            "// This is your Prisma schema file,
        // learn more about it in the docs: https://pris.ly/d/prisma-schema

        generator client {
          provider = "prisma-client-js"
        }

        datasource db {
          provider = "postgresql"
          url      = "postgres://user:password@randomhost:5432"
        }
        ",
          ],
        ]
      `)
      expect(e.schemaPath).toBeTruthy()
    }
  })

  it('format', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(5)
    process.env.FORCE_PANIC_QUERY_ENGINE_GET_DMMF = '1'

    const command = new Format()
    try {
      await command.parse([], defaultTestConfig())
    } catch (e) {
      expect(serialize(e.message)).toMatchInlineSnapshot(`
        ""RuntimeError: panicked at prisma-schema-wasm/src/lib.rs:0:0:
        This is the panic triggered by \`prisma_fmt::debug_panic()\`""
      `)
      expect(isRustPanic(e)).toBe(true)
      expect(e.rustStack).toBeTruthy()
      expect(sanitizeSchemas(e.schema)).toMatchInlineSnapshot(`
        [
          [
            "prisma/schema.prisma",
            "// This is your Prisma schema file,
        // learn more about it in the docs: https://pris.ly/d/prisma-schema

        generator client {
          provider = "prisma-client-js"
        }

        datasource db {
          provider = "postgresql"
          url      = "postgres://user:password@randomhost:5432"
        }
        ",
          ],
        ]
      `)
      expect(e.schemaPath).toBeTruthy()
    }
  })
})

describe('artificial-panic getDMMF', () => {
  const OLD_ENV = { ...process.env }

  afterEach(() => {
    process.env = { ...OLD_ENV }
  })

  it('getDMMF', async () => {
    ctx.fixture('artificial-panic')
    expect.assertions(5)
    process.env.FORCE_PANIC_QUERY_ENGINE_GET_DMMF = '1'

    try {
      await getDMMF({
        datamodel: /* prisma */ `generator client {
  provider = "prisma-client-js"
}`,
      })
    } catch (e) {
      expect(serialize(e.message)).toMatchInlineSnapshot(`
        ""RuntimeError: panicked at prisma-schema-wasm/src/lib.rs:0:0:
        This is the panic triggered by \`prisma_fmt::debug_panic()\`""
      `)
      expect(isRustPanic(e)).toBe(true)
      expect(e.rustStack).toBeTruthy()
      expect(e.schema).toMatchInlineSnapshot(`
        [
          [
            "schema.prisma",
            "generator client {
          provider = "prisma-client-js"
        }",
          ],
        ]
      `)
      expect(e).toMatchObject({
        schemaPath: undefined,
      })
    }
  })
})
