/* eslint-disable jest/no-identical-title */

import path from 'node:path'

import { defaultTestConfig } from '@prisma/config'
import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import { extractSchemaContent, getSchemaWithPath } from '@prisma/internals'
import fs from 'fs-jetpack'

import { Format } from '../../Format'
import { Validate } from '../../Validate'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

const originalEnv = { ...process.env }

describe('format', () => {
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
        await expect(Format.new().parse([], defaultTestConfig())).resolves.toMatchInlineSnapshot(
          `"Formatted schema.prisma in XXXms 🚀"`,
        )

        await expect(Format.new().parse(['--check'], defaultTestConfig())).resolves.toMatchInlineSnapshot(
          `"All files are formatted correctly!"`,
        )

        // explicit: single schema file (`schema.prisma`)
        await expect(
          Format.new().parse(['--schema=schema.prisma'], defaultTestConfig()),
        ).resolves.toMatchInlineSnapshot(`"Formatted schema.prisma in XXXms 🚀"`)

        // explicit: single schema file (`custom.prisma`)
        await expect(
          Format.new().parse(['--schema=custom.prisma'], defaultTestConfig()),
        ).resolves.toMatchInlineSnapshot(`"Formatted custom.prisma in XXXms 🚀"`)

        // explicit: single schema file (`prisma/custom.prisma`)
        await expect(
          Format.new().parse(['--schema=prisma/custom.prisma'], defaultTestConfig()),
        ).resolves.toMatchInlineSnapshot(`"Formatted prisma/custom.prisma in XXXms 🚀"`)

        // explicit: multi schema files with `prismaSchemaFolder` enabled
        await expect(
          Format.new().parse(['--schema=prisma/schema'], defaultTestConfig()),
        ).resolves.toMatchInlineSnapshot(`"Formatted prisma/schema in XXXms 🚀"`)

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

        // implicit: conflict between folder and file
        await expect(Format.new().parse([], defaultTestConfig())).rejects.toThrowErrorMatchingInlineSnapshot(
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
        await expect(Format.new().parse([], defaultTestConfig())).resolves.toMatchInlineSnapshot(
          `"Formatted prisma/schema in XXXms 🚀"`,
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

        await expect(Format.new().parse([], defaultTestConfig())).rejects.toMatchInlineSnapshot(`
          "Prisma schema validation - (validate wasm)
          Error code: P1012
          error: Argument "value" is missing.
            -->  prisma/schema/schema.prisma:2
             | 
           1 | model Link {
           2 |   id String @id @default()
             | 

          Validation Error Count: 1
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

        await expect(Format.new().parse([], defaultTestConfig())).rejects.toMatchInlineSnapshot(`
          "Prisma schema validation - (validate wasm)
          Error code: P1012
          error: Error parsing attribute "@default": The function \`now()\` cannot be used on fields of type \`Int\`.
            -->  prisma/schema/schema_with_config.prisma:12
             | 
          11 | model User {
          12 |   id Int @id @default(now())
             | 

          Validation Error Count: 1
          [Context: validate]

          Prisma CLI Version : 0.0.0"
        `)
      })

      it('reports error when schemas when the config blocks (`generator`, `datasource`) are invalid', async () => {
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

        await expect(Format.new().parse([], defaultTestConfig())).rejects.toThrowErrorMatchingInlineSnapshot(`
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

      it('should throw when both schema file and folder exist (even when invalid)', async () => {
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

        // implicit: single schema file (`prisma/schema.prisma`)
        await expect(Format.new().parse([], defaultTestConfig())).rejects.toThrowErrorMatchingInlineSnapshot(
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
        await expect(Format.new().parse([], defaultTestConfig())).resolves.toMatchInlineSnapshot(
          `"Formatted prisma/schema in XXXms 🚀"`,
        )
      })

      it('fixes invalid relations across multiple schema files', async () => {
        ctx.fixture('multi-schema-files/invalid/relations')

        // - `prisma/schema/schema1.prisma` is invalid (its model lacks a backrelation to the model in the other file)
        // - `prisma/schema/schema2.prisma` is valid
        expect(ctx.tree()).toMatchInlineSnapshot(`
          "
          └── prisma/
              └── schema/
                  └── schema1.prisma
                  └── schema2.prisma
                  └── skip.txt
          "
        `)

        await expect(Validate.new().parse([], defaultTestConfig())).rejects.toMatchInlineSnapshot(`
          "Prisma schema validation - (validate wasm)
          Error code: P1012
          error: Error validating field \`user\` in model \`Link\`: The relation field \`user\` on model \`Link\` is missing an opposite relation field on the model \`User\`. Either run \`prisma format\` or add it manually.
            -->  prisma/schema/schema2.prisma:7
             | 
           6 |   shortUrl  String
           7 |   user      User?    @relation(fields: [userId], references: [id])
           8 |   userId    String?
             | 

          Validation Error Count: 1
          [Context: validate]

          Prisma CLI Version : 0.0.0"
        `)
        await expect(Format.new().parse([], defaultTestConfig())).resolves.toMatchInlineSnapshot(
          `"Formatted prisma/schema in XXXms 🚀"`,
        )
        await expect(Validate.new().parse([], defaultTestConfig())).resolves.toMatchInlineSnapshot(
          `"The schemas at prisma/schema are valid 🚀"`,
        )

        const { schemas } = (await getSchemaWithPath())!

        // notice how the `Link` backrelation was added in the first schema file:
        expect(extractSchemaContent(schemas)).toMatchInlineSnapshot(`
          [
            "generator client {
            provider        = "prisma-client-js"
            previewFeatures = ["prismaSchemaFolder"]
          }

          datasource db {
            provider = "sqlite"
            url      = "file:dev.db"
          }

          model User {
            id        String    @id @default(uuid())
            createdAt DateTime  @default(now())
            updatedAt DateTime  @updatedAt
            name      String?
            email     String    @unique
            date      DateTime?
            // missing Link[]
            Link      Link[]
          }
          ",
            "model Link {
            id        String   @id @default(uuid())
            createdAt DateTime @default(now())
            updatedAt DateTime @updatedAt
            url       String
            shortUrl  String
            user      User?    @relation(fields: [userId], references: [id])
            userId    String?
          }
          ",
          ]
        `)
      })
    })
  })

  it('should add a trailing EOL', async () => {
    ctx.fixture('example-project/prisma')
    await Format.new().parse([], defaultTestConfig())
    expect(fs.read('schema.prisma')).toMatchSnapshot()
  })

  it('should add missing backrelation', async () => {
    ctx.fixture('example-project/prisma')
    await Format.new().parse(['--schema=missing-backrelation.prisma'], defaultTestConfig())
    expect(fs.read('missing-backrelation.prisma')).toMatchSnapshot()
  })

  it('should throw if schema is broken', async () => {
    ctx.fixture('example-project/prisma')
    await expect(Format.new().parse(['--schema=broken.prisma'], defaultTestConfig())).rejects.toThrow()
  })

  it('should succeed and show a warning on stderr (preview feature deprecated)', async () => {
    ctx.fixture('lint-warnings')
    await expect(
      Format.new().parse(['--schema=preview-feature-deprecated.prisma'], defaultTestConfig()),
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
      Format.new().parse(['--schema=preview-feature-deprecated-and-error.prisma'], defaultTestConfig()),
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
      Format.new().parse(['--schema=preview-feature-deprecated.prisma'], defaultTestConfig()),
    ).resolves.toBeTruthy()

    // stderr
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toEqual('')
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toEqual('')
  })

  it('check should fail on unformatted code', async () => {
    ctx.fixture('example-project/prisma-unformatted')
    await expect(
      Format.new().parse(['--schema=unformatted.prisma', '--check'], defaultTestConfig()),
    ).resolves.toMatchInlineSnapshot(`"! There are unformatted files. Run prisma format to format them."`)
  })
})
