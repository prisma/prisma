/* eslint-disable jest/no-identical-title */

import path from 'node:path'

import { defaultTestConfig } from '@prisma/config'
import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import { serializeQueryEngineName } from '@prisma/internals'

import { Validate } from '../../Validate'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

const originalEnv = { ...process.env }

describe('validate', () => {
  beforeEach(() => {
    process.env = { ...originalEnv }
  })
  afterAll(() => {
    process.env = { ...originalEnv }
  })

  describe('multi-schema-files with `prismaSchemaFolder`', () => {
    describe('valid schemas', () => {
      it('should prefer single file to the multi-schema alternatives', async () => {
        ctx.fixture('multi-schema-files/valid')
        expect(ctx.tree()).toMatchInlineSnapshot(`
          "
          └── prisma/
              └── schema/
                  └── schema1.prisma
                  └── schema2.prisma
              └── custom.prisma
              └── schema.prisma
          └── custom.prisma
          └── schema.prisma
          "
        `)

        // implicit: single schema file (`schema.prisma`)
        await expect(Validate.new().parse([], defaultTestConfig())).resolves.toMatchInlineSnapshot(
          `"The schema at schema.prisma is valid 🚀"`,
        )

        // explicit: single schema file (`schema.prisma`)
        await expect(
          Validate.new().parse(['--schema=schema.prisma'], defaultTestConfig()),
        ).resolves.toMatchInlineSnapshot(`"The schema at schema.prisma is valid 🚀"`)

        // explicit: single schema file (`custom.prisma`)
        await expect(
          Validate.new().parse(['--schema=custom.prisma'], defaultTestConfig()),
        ).resolves.toMatchInlineSnapshot(`"The schema at custom.prisma is valid 🚀"`)

        // explicit: single schema file (`prisma/custom.prisma`)
        await expect(
          Validate.new().parse(['--schema=prisma/custom.prisma'], defaultTestConfig()),
        ).resolves.toMatchInlineSnapshot(`"The schema at prisma/custom.prisma is valid 🚀"`)

        // explicit: multi schema files with `prismaSchemaFolder` enabled
        await expect(
          Validate.new().parse(['--schema=prisma/schema'], defaultTestConfig()),
        ).resolves.toMatchInlineSnapshot(`"The schemas at prisma/schema are valid 🚀"`)

        await ctx.fs.removeAsync('schema.prisma')
        expect(ctx.tree()).toMatchInlineSnapshot(`
          "
          └── prisma/
              └── schema/
                  └── schema1.prisma
                  └── schema2.prisma
              └── custom.prisma
              └── schema.prisma
          └── custom.prisma
          "
        `)

        // implicit: single schema file (`prisma/schema.prisma`)
        await expect(Validate.new().parse([], defaultTestConfig())).rejects.toThrowErrorMatchingInlineSnapshot(
          `"Found Prisma Schemas at both \`prisma/schema.prisma\` and \`prisma/schema\`. Please remove one."`,
        )

        await ctx.fs.removeAsync(path.join('prisma', 'schema.prisma'))
        expect(ctx.tree()).toMatchInlineSnapshot(`
          "
          └── prisma/
              └── schema/
                  └── schema1.prisma
                  └── schema2.prisma
              └── custom.prisma
          └── custom.prisma
          "
        `)

        // implicit: multi schema files with `prismaSchemaFolder` enabled
        await expect(Validate.new().parse([], defaultTestConfig())).resolves.toMatchInlineSnapshot(
          `"The schemas at prisma/schema are valid 🚀"`,
        )
      })
    })

    describe('invalid schemas', () => {
      it('parses multi schemas when the file containing the config blocks (`generator`, `datasource`) is valid', async () => {
        ctx.fixture('multi-schema-files/invalid/valid_config_file')
        expect(ctx.tree()).toMatchInlineSnapshot(`
          "
          └── prisma/
              └── schema/
                  └── config.prisma
                  └── schema.prisma
          "
        `)

        await expect(Validate.new().parse([], defaultTestConfig())).rejects.toMatchInlineSnapshot(`
          "Prisma schema validation - (validate wasm)
          Error code: P1012
          error: Argument "value" is missing.
            -->  prisma/schema/schema.prisma:2
             | 
           1 | model Link {
           2 |   id        String   @id @default()
             | 

          Validation Error Count: 1
          [Context: validate]

          Prisma CLI Version : 0.0.0"
        `)
      })

      it('reports multiple errors', async () => {
        ctx.fixture('multi-schema-files/invalid/multiple-errors')
        expect(ctx.tree()).toMatchInlineSnapshot(`
          "
          └── prisma/
              └── schema/
                  └── Blog.prisma
                  └── config.prisma
                  └── User.prisma
          "
        `)

        await expect(Validate.new().parse([], defaultTestConfig())).rejects.toMatchInlineSnapshot(`
          "Prisma schema validation - (validate wasm)
          Error code: P1012
          error: Error validating model "User": Each model must have at least one unique criteria that has only required fields. Either mark a single field with \`@id\`, \`@unique\` or add a multi field criterion with \`@@id([])\` or \`@@unique([])\` to the model.
            -->  prisma/schema/User.prisma:1
             | 
             | 
           1 | model User {
           2 |     id Int
           3 | 
           4 |     blogs Blog[]
           5 | }
             | 
          error: Error parsing attribute "@relation": The relation field \`owner\` on Model \`Blog\` must specify the \`fields\` argument in the @relation attribute. You can run \`prisma format\` to fix this automatically.
            -->  prisma/schema/Blog.prisma:5
             | 
           4 |     ownerId     Int
           5 |     owner       User 
           6 | }
             | 
          error: Error parsing attribute "@relation": The relation field \`owner\` on Model \`Blog\` must specify the \`references\` argument in the @relation attribute.
            -->  prisma/schema/Blog.prisma:5
             | 
           4 |     ownerId     Int
           5 |     owner       User 
           6 | }
             | 

          Validation Error Count: 3
          [Context: validate]

          Prisma CLI Version : 0.0.0"
        `)
      })

      it('parses multi schemas when the file containing the config blocks (`generator`, `datasource`) is valid', async () => {
        ctx.fixture('multi-schema-files/invalid/invalid_config_file')

        // - `prisma/schema/schema_with_config.prisma` is invalid (it contains valid config + invalid models)
        // - `prisma/schema/schema.prisma` is valid
        expect(ctx.tree()).toMatchInlineSnapshot(`
          "
          └── prisma/
              └── schema/
                  └── schema_with_config.prisma
                  └── schema.prisma
          "
        `)

        await expect(Validate.new().parse([], defaultTestConfig())).rejects.toMatchInlineSnapshot(`
          "Prisma schema validation - (validate wasm)
          Error code: P1012
          error: Error parsing attribute "@default": The function \`now()\` cannot be used on fields of type \`Int\`.
            -->  prisma/schema/schema_with_config.prisma:12
             | 
          11 | model User {
          12 |   id    Int     @id @default(now())
             | 

          Validation Error Count: 1
          [Context: validate]

          Prisma CLI Version : 0.0.0"
        `)
      })

      it('correctly reports error if config blocks (`generator`, `datasource`) are invalid', async () => {
        ctx.fixture('multi-schema-files/invalid/invalid_config_blocks')

        // - `prisma/schema/config.prisma` is invalid (it contains invalid attributes)
        // - `prisma/schema/schema.prisma` is valid
        expect(ctx.tree()).toMatchInlineSnapshot(`
          "
          └── prisma/
              └── schema/
                  └── config.prisma
                  └── schema.prisma
          "
        `)

        await expect(Validate.new().parse([], defaultTestConfig())).rejects.toMatchInlineSnapshot(`
          "Prisma schema validation - (get-config wasm)
          Error code: P1012
          error: Property not known: "custom".
            -->  prisma/schema/config.prisma:8
             | 
           7 |   provider = "sqlite"
           8 |   custom   = "attr"
             | 

          Validation Error Count: 1
          [Context: getConfig]

          Prisma CLI Version : 0.0.0"
        `)
      })

      it('should throw conflict error even if schemas are invalid', async () => {
        ctx.fixture('multi-schema-files/invalid/default_schema_invalid-multi_schema_valid')
        expect(ctx.tree()).toMatchInlineSnapshot(`
          "
          └── prisma/
              └── schema/
                  └── schema1.prisma
                  └── schema2.prisma
                  └── skip.txt
              └── schema.prisma
          "
        `)

        await expect(Validate.new().parse([], defaultTestConfig())).rejects.toThrowErrorMatchingInlineSnapshot(
          `"Found Prisma Schemas at both \`prisma/schema.prisma\` and \`prisma/schema\`. Please remove one."`,
        )

        await ctx.fs.removeAsync(path.join('prisma', 'schema.prisma'))
        expect(ctx.tree()).toMatchInlineSnapshot(`
          "
          └── prisma/
              └── schema/
                  └── schema1.prisma
                  └── schema2.prisma
                  └── skip.txt
          "
        `)

        // implicit: multi schema files (`prisma/schema`)
        await expect(Validate.new().parse([], defaultTestConfig())).resolves.toMatchInlineSnapshot(
          `"The schemas at prisma/schema are valid 🚀"`,
        )
      })
    })
  })

  it('should succeed if schema is valid', async () => {
    ctx.fixture('example-project/prisma')
    await expect(Validate.new().parse(['--schema=schema.prisma'], defaultTestConfig())).resolves.toContain('is valid')
  })

  it('should throw if schema is invalid', async () => {
    ctx.fixture('example-project/prisma')
    await expect(Validate.new().parse(['--schema=broken.prisma'], defaultTestConfig())).rejects.toThrow(
      'Prisma schema validation',
    )
  })

  it('should throw if env var is not set', async () => {
    ctx.fixture('example-project/prisma')
    await expect(Validate.new().parse(['--schema=env-does-not-exists.prisma'], defaultTestConfig())).rejects.toThrow(
      'Environment variable not found',
    )
  })

  it('should succeed and show a warning on stderr (preview feature deprecated)', async () => {
    ctx.fixture('lint-warnings')
    await expect(
      Validate.new().parse(['--schema=preview-feature-deprecated.prisma'], defaultTestConfig()),
    ).resolves.toBeTruthy()

    // stderr
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      "
      Prisma schema warning:
      - Preview feature "nativeTypes" is deprecated. The functionality can be used without specifying it as a preview feature."
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  it('should throw with an error and show a warning on stderr (preview feature deprecated)', async () => {
    ctx.fixture('lint-warnings')
    await expect(
      Validate.new().parse(['--schema=preview-feature-deprecated-and-error.prisma'], defaultTestConfig()),
    ).rejects.toThrow('P1012')

    // stderr
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      "
      Prisma schema warning:
      - Preview feature "nativeTypes" is deprecated. The functionality can be used without specifying it as a preview feature."
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(`""`)
  })

  it('should succeed and NOT show a warning when PRISMA_DISABLE_WARNINGS is truthy', async () => {
    ctx.fixture('lint-warnings')

    process.env.PRISMA_DISABLE_WARNINGS = 'true'

    await expect(
      Validate.new().parse(['--schema=preview-feature-deprecated.prisma'], defaultTestConfig()),
    ).resolves.toBeTruthy()

    // stderr
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toEqual('')
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toEqual('')
  })

  describe('referential actions', () => {
    beforeEach(() => {
      ctx.fixture('referential-actions/no-action/relationMode-prisma')
    })

    it('should reject NoAction referential action on Postgres when relationMode = "prisma"', async () => {
      expect.assertions(1)

      try {
        await Validate.new().parse(['--schema', './prisma/postgres.prisma'], defaultTestConfig())
      } catch (e) {
        expect(serializeQueryEngineName(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (validate wasm)
          Error code: P1012
          error: Error validating: Invalid referential action: \`NoAction\`. Allowed values: (\`Cascade\`, \`Restrict\`, \`SetNull\`). \`NoAction\` is not implemented for Postgres when using \`relationMode = "prisma"\`, you could try using \`Restrict\` instead. Learn more at https://pris.ly/d/relation-mode
            -->  prisma/postgres.prisma:21
             | 
          20 |   id       String @id @default(cuid())
          21 |   user     SomeUser @relation(fields: [userId], references: [id], onUpdate: NoAction)
             | 
          error: Error validating: Invalid referential action: \`NoAction\`. Allowed values: (\`Cascade\`, \`Restrict\`, \`SetNull\`). \`NoAction\` is not implemented for Postgres when using \`relationMode = "prisma"\`, you could try using \`Restrict\` instead. Learn more at https://pris.ly/d/relation-mode
            -->  prisma/postgres.prisma:28
             | 
          27 |   id       String @id @default(cuid())
          28 |   user     SomeUser @relation(fields: [userId], references: [id], onDelete: NoAction)
             | 

          Validation Error Count: 2
          [Context: validate]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    it('should reject NoAction referential action on sqlite when relationMode = "prisma"', async () => {
      expect.assertions(1)

      try {
        await Validate.new().parse(['--schema', './prisma/postgres.prisma'], defaultTestConfig())
      } catch (e) {
        expect(serializeQueryEngineName(e.message)).toMatchInlineSnapshot(`
          "Prisma schema validation - (validate wasm)
          Error code: P1012
          error: Error validating: Invalid referential action: \`NoAction\`. Allowed values: (\`Cascade\`, \`Restrict\`, \`SetNull\`). \`NoAction\` is not implemented for Postgres when using \`relationMode = "prisma"\`, you could try using \`Restrict\` instead. Learn more at https://pris.ly/d/relation-mode
            -->  prisma/postgres.prisma:21
             | 
          20 |   id       String @id @default(cuid())
          21 |   user     SomeUser @relation(fields: [userId], references: [id], onUpdate: NoAction)
             | 
          error: Error validating: Invalid referential action: \`NoAction\`. Allowed values: (\`Cascade\`, \`Restrict\`, \`SetNull\`). \`NoAction\` is not implemented for Postgres when using \`relationMode = "prisma"\`, you could try using \`Restrict\` instead. Learn more at https://pris.ly/d/relation-mode
            -->  prisma/postgres.prisma:28
             | 
          27 |   id       String @id @default(cuid())
          28 |   user     SomeUser @relation(fields: [userId], references: [id], onDelete: NoAction)
             | 

          Validation Error Count: 2
          [Context: validate]

          Prisma CLI Version : 0.0.0"
        `)
      }
    })

    it('should accept NoAction referential action on e.g. MySQL when relationMode = "prisma"', async () => {
      const result = await Validate.new().parse(['--schema', './prisma/mysql.prisma'], defaultTestConfig())
      expect(result).toBeTruthy()
    })
  })
})
