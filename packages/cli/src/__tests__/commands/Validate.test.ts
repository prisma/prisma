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

  it('should succeed if schema is valid', async () => {
    ctx.fixture('example-project/prisma')
    await expect(Validate.new().parse(['--schema=schema.prisma'])).resolves.toContain('is valid')
  })

  it('should throw if schema is invalid', async () => {
    ctx.fixture('example-project/prisma')
    await expect(Validate.new().parse(['--schema=broken.prisma'])).rejects.toThrow('Prisma schema validation')
  })

  it('should throw if env var is not set', async () => {
    ctx.fixture('example-project/prisma')
    await expect(Validate.new().parse(['--schema=env-does-not-exists.prisma'])).rejects.toThrow(
      'Environment variable not found',
    )
  })

  it('should succeed and show a warning on stderr (preview feature deprecated)', async () => {
    ctx.fixture('lint-warnings')
    await expect(Validate.new().parse(['--schema=preview-feature-deprecated.prisma'])).resolves.toBeTruthy()

    // stderr
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                                    Prisma schema warning:
                                    - Preview feature "nativeTypes" is deprecated. The functionality can be used without specifying it as a preview feature.
                      `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should throw with an error and show a warning on stderr (preview feature deprecated)', async () => {
    ctx.fixture('lint-warnings')
    await expect(Validate.new().parse(['--schema=preview-feature-deprecated-and-error.prisma'])).rejects.toThrow(
      'P1012',
    )

    // stderr
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`

                                    Prisma schema warning:
                                    - Preview feature "nativeTypes" is deprecated. The functionality can be used without specifying it as a preview feature.
                      `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('should succeed and NOT show a warning when PRISMA_DISABLE_WARNINGS is truthy', async () => {
    ctx.fixture('lint-warnings')

    process.env.PRISMA_DISABLE_WARNINGS = 'true'

    await expect(Validate.new().parse(['--schema=preview-feature-deprecated.prisma'])).resolves.toBeTruthy()

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
        await Validate.new().parse(['--schema', './prisma/postgres.prisma'])
      } catch (e) {
        expect(serializeQueryEngineName(e.message)).toMatchInlineSnapshot(`
          Prisma schema validation - (validate wasm)
          Error code: P1012
          error: Error validating: Invalid referential action: \`NoAction\`. Allowed values: (\`Cascade\`, \`Restrict\`, \`SetNull\`). \`NoAction\` is not implemented for Postgres when using \`relationMode = "prisma"\`, you could try using \`Restrict\` instead. Learn more at https://pris.ly/d/relation-mode
            -->  schema.prisma:21
             | 
          20 |   id       String @id @default(cuid())
          21 |   user     SomeUser @relation(fields: [userId], references: [id], onUpdate: NoAction)
             | 
          error: Error validating: Invalid referential action: \`NoAction\`. Allowed values: (\`Cascade\`, \`Restrict\`, \`SetNull\`). \`NoAction\` is not implemented for Postgres when using \`relationMode = "prisma"\`, you could try using \`Restrict\` instead. Learn more at https://pris.ly/d/relation-mode
            -->  schema.prisma:28
             | 
          27 |   id       String @id @default(cuid())
          28 |   user     SomeUser @relation(fields: [userId], references: [id], onDelete: NoAction)
             | 

          Validation Error Count: 2
          [Context: validate]

          Prisma CLI Version : 0.0.0
        `)
      }
    })

    it('should reject NoAction referential action on sqlite when relationMode = "prisma"', async () => {
      expect.assertions(1)

      try {
        await Validate.new().parse(['--schema', './prisma/postgres.prisma'])
      } catch (e) {
        expect(serializeQueryEngineName(e.message)).toMatchInlineSnapshot(`
          Prisma schema validation - (validate wasm)
          Error code: P1012
          error: Error validating: Invalid referential action: \`NoAction\`. Allowed values: (\`Cascade\`, \`Restrict\`, \`SetNull\`). \`NoAction\` is not implemented for Postgres when using \`relationMode = "prisma"\`, you could try using \`Restrict\` instead. Learn more at https://pris.ly/d/relation-mode
            -->  schema.prisma:21
             | 
          20 |   id       String @id @default(cuid())
          21 |   user     SomeUser @relation(fields: [userId], references: [id], onUpdate: NoAction)
             | 
          error: Error validating: Invalid referential action: \`NoAction\`. Allowed values: (\`Cascade\`, \`Restrict\`, \`SetNull\`). \`NoAction\` is not implemented for Postgres when using \`relationMode = "prisma"\`, you could try using \`Restrict\` instead. Learn more at https://pris.ly/d/relation-mode
            -->  schema.prisma:28
             | 
          27 |   id       String @id @default(cuid())
          28 |   user     SomeUser @relation(fields: [userId], references: [id], onDelete: NoAction)
             | 

          Validation Error Count: 2
          [Context: validate]

          Prisma CLI Version : 0.0.0
        `)
      }
    })

    it('should accept NoAction referential action on e.g. MySQL when relationMode = "prisma"', async () => {
      const result = await Validate.new().parse(['--schema', './prisma/mysql.prisma'])
      expect(result).toBeTruthy()
    })
  })
})
