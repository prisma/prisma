import { getClientEngineType, jestConsoleContext, jestContext, jestProcessContext } from '@prisma/internals'
import path from 'path'

import { Generate } from '../../Generate'

const stripAnsi = require('strip-ansi')

const ctx = jestContext.new().add(jestConsoleContext()).add(jestProcessContext()).assemble()

describe('using cli', () => {
  it('should work with a custom output dir', async () => {
    ctx.fixture('example-project')
    const data = await ctx.cli('generate')

    if (typeof data.signal === 'number' && data.signal !== 0) {
      throw new Error(data.stderr + data.stdout)
    }

    const { main } = await import(ctx.fs.path('main.ts'))
    expect(replaceEngineType(data.stdout)).toMatchSnapshot()
    await expect(main()).resolves.toMatchSnapshot()
  }, 60_000) // timeout

  it('should error with exit code 1 with incorrect schema', async () => {
    ctx.fixture('broken-example-project')
    await expect(ctx.cli('generate').catch((e) => e.exitCode)).resolves.toEqual(1)
  })

  it('should work with a custom generator', async () => {
    ctx.fixture('custom-generator')
    const data = await ctx.cli('generate')

    if (typeof data.signal === 'number' && data.signal !== 0) {
      throw new Error(data.stderr + data.stdout)
    }

    expect(data.stdout).toContain(`I am a minimal generator`)
  }, 75_000) // timeout
})

describe('--schema from project directory', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
  })
  afterAll(() => {
    process.env = { ...originalEnv }
  })

  it('--schema relative path: should work', async () => {
    expect.assertions(2)
    ctx.fixture('generate-from-project-dir')
    const result = await Generate.new().parse(['--schema=./schema.prisma'])
    const output = stripAnsi(replaceEngineType(result))
    expect(output).toMatchInlineSnapshot(`

                                                                  ✔ Generated Prisma Client (0.0.0 | TEST_ENGINE_TYPE) to ./@prisma/client in XXXms
                                                                  You can now start using Prisma Client in your code. Reference: https://pris.ly/d/client
                                                                  \`\`\`
                                                                  import { PrismaClient } from './@prisma/client'
                                                                  const prisma = new PrismaClient()
                                                                  \`\`\`
                                            `)
    // Check that the client path in the import statement actually contains
    // forward slashes regardless of the platform (a snapshot test wouldn't
    // detect the difference because backward slashes are replaced with forward
    // slashes by the snapshot serializer).
    expect(output).toContain("import { PrismaClient } from './@prisma/client'")
  })

  it('--schema relative path: should fail - invalid path', async () => {
    ctx.fixture('generate-from-project-dir')
    const result = Generate.new().parse(['--schema=./doesnotexists.prisma'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `Provided --schema at ./doesnotexists.prisma doesn't exist.`,
    )
  })

  it('--schema absolute path: should work', async () => {
    ctx.fixture('generate-from-project-dir')
    const absoluteSchemaPath = path.resolve('./schema.prisma')
    const result = await Generate.new().parse([`--schema=${absoluteSchemaPath}`])
    expect(replaceEngineType(result)).toMatchInlineSnapshot(`

                                                                  ✔ Generated Prisma Client (0.0.0 | TEST_ENGINE_TYPE) to ./@prisma/client in XXXms
                                                                  You can now start using Prisma Client in your code. Reference: https://pris.ly/d/client
                                                                  \`\`\`
                                                                  import { PrismaClient } from './@prisma/client'
                                                                  const prisma = new PrismaClient()
                                                                  \`\`\`
                                            `)
  })

  it('--schema absolute path: should work and show validation warnings', async () => {
    ctx.fixture('generate-from-project-dir')
    const absoluteSchemaPath = path.resolve('./lint-warning.prisma')
    const result = await Generate.new().parse([`--schema=${absoluteSchemaPath}`])
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(
      `Prisma schema loaded from lint-warning.prisma`,
    )
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(
      `warn Preview feature "referentialIntegrity" is deprecated. The functionality can be used without specifying it as a preview feature.`,
    )
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(replaceEngineType(result)).toMatchInlineSnapshot(`

                                                                  ✔ Generated Prisma Client (0.0.0 | TEST_ENGINE_TYPE) to ./@prisma/client in XXXms
                                                                  You can now start using Prisma Client in your code. Reference: https://pris.ly/d/client
                                                                  \`\`\`
                                                                  import { PrismaClient } from './@prisma/client'
                                                                  const prisma = new PrismaClient()
                                                                  \`\`\`
                                            `)
  })

  it('--schema absolute path: should work and not show validation warnings when PRISMA_DISABLE_WARNINGS is truthy', async () => {
    ctx.fixture('generate-from-project-dir')
    process.env.PRISMA_DISABLE_WARNINGS = 'true'

    const absoluteSchemaPath = path.resolve('./lint-warning.prisma')
    const result = await Generate.new().parse([`--schema=${absoluteSchemaPath}`])
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(
      `Prisma schema loaded from lint-warning.prisma`,
    )
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(replaceEngineType(result)).toMatchInlineSnapshot(`

                              ✔ Generated Prisma Client (0.0.0 | TEST_ENGINE_TYPE) to ./@prisma/client in XXXms
                              You can now start using Prisma Client in your code. Reference: https://pris.ly/d/client
                              \`\`\`
                              import { PrismaClient } from './@prisma/client'
                              const prisma = new PrismaClient()
                              \`\`\`
        `)
  })

  it('--schema absolute path: should fail - invalid path', async () => {
    ctx.fixture('generate-from-project-dir')
    const absoluteSchemaPath = path.resolve('./doesnotexists.prisma')
    const result = Generate.new().parse([`--schema=${absoluteSchemaPath}`])
    await expect(result).rejects.toThrowError(`Provided --schema at ${absoluteSchemaPath} doesn't exist.`)
  })

  it('--schema absolute path: should fail with invalid schema', async () => {
    ctx.fixture('generate-from-project-dir')
    const absoluteSchemaPath = path.resolve('./invalid.prisma')
    const result = Generate.new().parse([`--schema=${absoluteSchemaPath}`])
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    await expect(result).rejects.toThrowError(`Error validating model`)
  })

  it('--schema absolute path: should fail with invalid schema and show validation warnings', async () => {
    ctx.fixture('generate-from-project-dir')
    const absoluteSchemaPath = path.resolve('./invalid-and-lint-warning.prisma')
    const result = Generate.new().parse([`--schema=${absoluteSchemaPath}`])
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(
      `warn Preview feature "referentialIntegrity" is deprecated. The functionality can be used without specifying it as a preview feature.`,
    )
    expect(ctx.mocked['process.stdout.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['process.stderr.write'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    await expect(result).rejects.toThrowError(`Error validating model`)
  })
})

describe('--schema from parent directory', () => {
  it('--schema relative path: should work', async () => {
    expect.assertions(2)
    ctx.fixture('generate-from-parent-dir')
    const result = await Generate.new().parse(['--schema=./subdirectory/schema.prisma'])
    const output = stripAnsi(replaceEngineType(result))
    expect(output).toMatchInlineSnapshot(`

                                                                  ✔ Generated Prisma Client (0.0.0 | TEST_ENGINE_TYPE) to ./subdirectory/@prisma/client in XXXms
                                                                  You can now start using Prisma Client in your code. Reference: https://pris.ly/d/client
                                                                  \`\`\`
                                                                  import { PrismaClient } from './subdirectory/@prisma/client'
                                                                  const prisma = new PrismaClient()
                                                                  \`\`\`
                                            `)
    // Check that the client path in the import statement actually contains
    // forward slashes regardless of the platform (a snapshot test wouldn't
    // detect the difference because backward slashes are replaced with forward
    // slashes by the snapshot serializer).
    expect(output).toContain("import { PrismaClient } from './subdirectory/@prisma/client'")
  })

  it('--schema relative path: should fail - invalid path', async () => {
    ctx.fixture('generate-from-parent-dir')

    const result = Generate.new().parse(['--schema=./subdirectory/doesnotexists.prisma'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `Provided --schema at ./subdirectory/doesnotexists.prisma doesn't exist.`,
    )
  })

  it('--schema absolute path: should work', async () => {
    expect.assertions(2)
    ctx.fixture('generate-from-parent-dir')
    const absoluteSchemaPath = path.resolve('./subdirectory/schema.prisma')
    const result = await Generate.new().parse([`--schema=${absoluteSchemaPath}`])
    const output = stripAnsi(replaceEngineType(result))
    expect(output).toMatchInlineSnapshot(`

                                                                  ✔ Generated Prisma Client (0.0.0 | TEST_ENGINE_TYPE) to ./subdirectory/@prisma/client in XXXms
                                                                  You can now start using Prisma Client in your code. Reference: https://pris.ly/d/client
                                                                  \`\`\`
                                                                  import { PrismaClient } from './subdirectory/@prisma/client'
                                                                  const prisma = new PrismaClient()
                                                                  \`\`\`
                                            `)
    // Check that the client path in the import statement actually contains
    // forward slashes regardless of the platform (a snapshot test wouldn't
    // detect the difference because backward slashes are replaced with forward
    // slashes by the snapshot serializer).
    expect(output).toContain("import { PrismaClient } from './subdirectory/@prisma/client'")
  })

  it('--schema absolute path: should fail - invalid path', async () => {
    ctx.fixture('generate-from-parent-dir')

    const absoluteSchemaPath = path.resolve('./subdirectory/doesnotexists.prisma')
    const result = Generate.new().parse([`--schema=${absoluteSchemaPath}`])
    await expect(result).rejects.toThrowError(`Provided --schema at ${absoluteSchemaPath} doesn't exist.`)
  })
})

function replaceEngineType(result: string | Error) {
  if (result instanceof Error) {
    return result
  }
  return result.replace(new RegExp(getClientEngineType(), 'g'), 'TEST_ENGINE_TYPE')
}
