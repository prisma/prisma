import path from 'path'
import { getClientEngineType } from '@prisma/sdk'
import { Generate } from '../../Generate'
import { jestConsoleContext, jestContext } from '@prisma/sdk'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describe('using cli', () => {
  it('should work with a custom output dir', async () => {
    ctx.fixture('example-project')
    const data = await ctx.cli('generate')

    if (typeof data.signal === 'number' && data.signal !== 0) {
      throw new Error(data.stderr + data.stdout)
    }

    const { main } = await import(ctx.fs.path('main.ts'))
    expect(cleanSnapshot(data.stdout)).toMatchSnapshot()
    await expect(main()).resolves.toMatchSnapshot()
  }, 60000) // timeout

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

    expect(cleanSnapshot(data.stdout)).toContain(`I am a minimal generator`)
  }, 50000) // timeout
})

describe('--schema from project directory', () => {
  it('--schema relative path: should work', async () => {
    ctx.fixture('generate-from-project-dir')
    const result = await Generate.new().parse(['--schema=./schema.prisma'])
    expect(replaceEngineType(result)).toMatchInlineSnapshot(`

      ✔ Generated Prisma Client (0.0.0 | TEST_ENGINE_TYPE) to ./@prisma/client in XXXms
      You can now start using Prisma Client in your code. Reference: https://pris.ly/d/client
      \`\`\`
      import { PrismaClient } from './@prisma/client'
      const prisma = new PrismaClient()
      \`\`\`
    `)
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

  it('--schema absolute path: should fail - invalid path', async () => {
    ctx.fixture('generate-from-project-dir')
    const absoluteSchemaPath = path.resolve('./doesnotexists.prisma')
    const result = Generate.new().parse([`--schema=${absoluteSchemaPath}`])
    await expect(result).rejects.toThrowError(`Provided --schema at ${absoluteSchemaPath} doesn't exist.`)
  })
})

describe('--schema from parent directory', () => {
  it('--schema relative path: should work', async () => {
    ctx.fixture('generate-from-parent-dir')
    const result = await Generate.new().parse(['--schema=./subdirectory/schema.prisma'])
    expect(replaceEngineType(result)).toMatchInlineSnapshot(`

      ✔ Generated Prisma Client (0.0.0 | TEST_ENGINE_TYPE) to ./subdirectory/@prisma/client in XXXms
      You can now start using Prisma Client in your code. Reference: https://pris.ly/d/client
      \`\`\`
      import { PrismaClient } from './subdirectory/@prisma/client'
      const prisma = new PrismaClient()
      \`\`\`
    `)
  })

  it('--schema relative path: should fail - invalid path', async () => {
    ctx.fixture('generate-from-parent-dir')

    const result = Generate.new().parse(['--schema=./subdirectory/doesnotexists.prisma'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `Provided --schema at ./subdirectory/doesnotexists.prisma doesn't exist.`,
    )
  })

  it('--schema absolute path: should work', async () => {
    ctx.fixture('generate-from-parent-dir')

    const absoluteSchemaPath = path.resolve('./subdirectory/schema.prisma')
    const result = await Generate.new().parse([`--schema=${absoluteSchemaPath}`])
    expect(replaceEngineType(result)).toMatchInlineSnapshot(`

      ✔ Generated Prisma Client (0.0.0 | TEST_ENGINE_TYPE) to ./subdirectory/@prisma/client in XXXms
      You can now start using Prisma Client in your code. Reference: https://pris.ly/d/client
      \`\`\`
      import { PrismaClient } from './subdirectory/@prisma/client'
      const prisma = new PrismaClient()
      \`\`\`
    `)
  })

  it('--schema absolute path: should fail - invalid path', async () => {
    ctx.fixture('generate-from-parent-dir')

    const absoluteSchemaPath = path.resolve('./subdirectory/doesnotexists.prisma')
    const result = Generate.new().parse([`--schema=${absoluteSchemaPath}`])
    await expect(result).rejects.toThrowError(`Provided --schema at ${absoluteSchemaPath} doesn't exist.`)
  })
})

function cleanSnapshot(str: string): string {
  return str
    .replace(/\d+ms/g, 'XXms')
    .replace(/\d+s/g, 'XXms')
    .replace(/\(version:.+\)/g, '(version: 0.0.0)')
    .replace(new RegExp(getClientEngineType(), 'g'), 'TEST_ENGINE_TYPE')
}

function replaceEngineType(result: string | Error) {
  if (result instanceof Error) {
    return result
  }
  return result.replace(new RegExp(getClientEngineType(), 'g'), 'TEST_ENGINE_TYPE')
}
