import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import { ClientEngineType, getClientEngineType } from '@prisma/internals'
import path from 'path'

import { Generate } from '../../Generate'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describe('using cli', () => {
  it('should work with a custom output dir', async () => {
    ctx.fixture('example-project')
    const data = await ctx.cli('generate')

    if (typeof data.signal === 'number' && data.signal !== 0) {
      throw new Error(data.stderr + data.stdout)
    }

    const { main } = await import(ctx.fs.path('main.ts'))

    if (getClientEngineType() === ClientEngineType.Binary) {
      expect(data.stdout).toMatchInlineSnapshot(`
        Prisma schema loaded from prisma/schema.prisma

        ✔ Generated Prisma Client (v0.0.0, engine=binary) to ./generated/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './generated/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './generated/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

      `)
    } else {
      expect(data.stdout).toMatchInlineSnapshot(`
        Prisma schema loaded from prisma/schema.prisma

        ✔ Generated Prisma Client (v0.0.0) to ./generated/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './generated/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './generated/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

      `)
    }

    await expect(main()).resolves.toMatchInlineSnapshot(`
      [
        {
          email: bob@bob.bob,
          id: 1,
          name: Bobby Brown Sqlite,
        },
      ]
    `)
  }, 60_000) // timeout

  it('should work with --no-engine', async () => {
    ctx.fixture('example-project')
    const data = await ctx.cli('generate', '--no-engine')

    if (typeof data.signal === 'number' && data.signal !== 0) {
      throw new Error(data.stderr + data.stdout)
    }

    if (getClientEngineType() === ClientEngineType.Binary) {
      expect(data.stdout).toMatchInlineSnapshot(`
        Prisma schema loaded from prisma/schema.prisma

        ✔ Generated Prisma Client (v0.0.0, engine=none) to ./generated/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './generated/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './generated/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

      `)
    } else {
      expect(data.stdout).toMatchInlineSnapshot(`
        Prisma schema loaded from prisma/schema.prisma

        ✔ Generated Prisma Client (v0.0.0, engine=none) to ./generated/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './generated/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './generated/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

      `)
    }
  })

  it('should warn when `url` is hardcoded', async () => {
    ctx.fixture('hardcoded-url')
    const data = await ctx.cli('generate')

    if (typeof data.signal === 'number' && data.signal !== 0) {
      throw new Error(data.stderr + data.stdout)
    }

    if (getClientEngineType() === ClientEngineType.Binary) {
      expect(data.stdout).toMatchInlineSnapshot(`
        Prisma schema loaded from prisma/schema.prisma

        ✔ Generated Prisma Client (v0.0.0, engine=binary) to ./generated/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './generated/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './generated/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

        🛑 Hardcoding URLs in your schema poses a security risk: https://pris.ly/d/datasource-env

      `)
    } else {
      expect(data.stdout).toMatchInlineSnapshot(`
        Prisma schema loaded from prisma/schema.prisma

        ✔ Generated Prisma Client (v0.0.0) to ./generated/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './generated/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './generated/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

        🛑 Hardcoding URLs in your schema poses a security risk: https://pris.ly/d/datasource-env

      `)
    }
  })

  it('should not warn when `url` is not hardcoded', async () => {
    ctx.fixture('env-url')
    const data = await ctx.cli('generate')

    if (typeof data.signal === 'number' && data.signal !== 0) {
      throw new Error(data.stderr + data.stdout)
    }

    if (getClientEngineType() === ClientEngineType.Binary) {
      expect(data.stdout).toMatchInlineSnapshot(`
        Prisma schema loaded from prisma/schema.prisma

        ✔ Generated Prisma Client (v0.0.0, engine=binary) to ./generated/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './generated/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './generated/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

      `)
    } else {
      expect(data.stdout).toMatchInlineSnapshot(`
        Prisma schema loaded from prisma/schema.prisma

        ✔ Generated Prisma Client (v0.0.0) to ./generated/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './generated/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './generated/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

      `)
    }
  })

  it('should not warn when `directUrl` is not hardcoded', async () => {
    ctx.fixture('env-direct-url')
    const data = await ctx.cli('generate')

    if (typeof data.signal === 'number' && data.signal !== 0) {
      throw new Error(data.stderr + data.stdout)
    }

    if (getClientEngineType() === ClientEngineType.Binary) {
      expect(data.stdout).toMatchInlineSnapshot(`
        Prisma schema loaded from prisma/schema.prisma

        ✔ Generated Prisma Client (v0.0.0, engine=binary) to ./generated/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './generated/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './generated/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

      `)
    } else {
      expect(data.stdout).toMatchInlineSnapshot(`
        Prisma schema loaded from prisma/schema.prisma

        ✔ Generated Prisma Client (v0.0.0) to ./generated/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './generated/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './generated/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

      `)
    }
  })

  it('should warn when `directUrl` is hardcoded', async () => {
    ctx.fixture('hardcoded-direct-url')
    const data = await ctx.cli('generate')

    if (typeof data.signal === 'number' && data.signal !== 0) {
      throw new Error(data.stderr + data.stdout)
    }

    if (getClientEngineType() === ClientEngineType.Binary) {
      expect(data.stdout).toMatchInlineSnapshot(`
        Prisma schema loaded from prisma/schema.prisma

        ✔ Generated Prisma Client (v0.0.0, engine=binary) to ./generated/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './generated/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './generated/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

        🛑 Hardcoding URLs in your schema poses a security risk: https://pris.ly/d/datasource-env

      `)
    } else {
      expect(data.stdout).toMatchInlineSnapshot(`
        Prisma schema loaded from prisma/schema.prisma

        ✔ Generated Prisma Client (v0.0.0) to ./generated/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './generated/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './generated/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

        🛑 Hardcoding URLs in your schema poses a security risk: https://pris.ly/d/datasource-env

      `)
    }
  })

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
  it('--schema relative path: should work', async () => {
    expect.assertions(1)
    ctx.fixture('generate-from-project-dir')
    const result = await Generate.new().parse(['--schema=./schema.prisma'])

    if (getClientEngineType() === ClientEngineType.Binary) {
      expect(result).toMatchInlineSnapshot(`

        ✔ Generated Prisma Client (v0.0.0, engine=binary) to ./@prisma/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './@prisma/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './@prisma/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

                                          `)
    } else {
      expect(result).toMatchInlineSnapshot(`

        ✔ Generated Prisma Client (v0.0.0) to ./@prisma/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './@prisma/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './@prisma/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

                                                `)
    }
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
    const output = await Generate.new().parse([`--schema=${absoluteSchemaPath}`])

    if (getClientEngineType() === ClientEngineType.Binary) {
      expect(output).toMatchInlineSnapshot(`

        ✔ Generated Prisma Client (v0.0.0, engine=binary) to ./@prisma/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './@prisma/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './@prisma/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

                                          `)
    } else {
      expect(output).toMatchInlineSnapshot(`

        ✔ Generated Prisma Client (v0.0.0) to ./@prisma/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './@prisma/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './@prisma/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

                                                `)
    }
  })

  it('--schema absolute path: should fail - invalid path', async () => {
    ctx.fixture('generate-from-project-dir')
    const absoluteSchemaPath = path.resolve('./doesnotexists.prisma')
    const result = Generate.new().parse([`--schema=${absoluteSchemaPath}`])
    await expect(result).rejects.toThrow(`Provided --schema at ${absoluteSchemaPath} doesn't exist.`)
  })
})

describe('--schema from parent directory', () => {
  it('--schema relative path: should work', async () => {
    expect.assertions(1)
    ctx.fixture('generate-from-parent-dir')
    const result = await Generate.new().parse(['--schema=./subdirectory/schema.prisma'])

    if (getClientEngineType() === ClientEngineType.Binary) {
      expect(result).toMatchInlineSnapshot(`

        ✔ Generated Prisma Client (v0.0.0, engine=binary) to ./subdirectory/@prisma/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './subdirectory/@prisma/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './subdirectory/@prisma/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

                                          `)
    } else {
      expect(result).toMatchInlineSnapshot(`

        ✔ Generated Prisma Client (v0.0.0) to ./subdirectory/@prisma/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './subdirectory/@prisma/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './subdirectory/@prisma/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

                                                `)
    }
  })

  it('--schema relative path: should fail - invalid path', async () => {
    ctx.fixture('generate-from-parent-dir')

    const result = Generate.new().parse(['--schema=./subdirectory/doesnotexists.prisma'])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(
      `Provided --schema at ./subdirectory/doesnotexists.prisma doesn't exist.`,
    )
  })

  it('--schema absolute path: should work', async () => {
    expect.assertions(1)
    ctx.fixture('generate-from-parent-dir')
    const absoluteSchemaPath = path.resolve('./subdirectory/schema.prisma')
    const result = await Generate.new().parse([`--schema=${absoluteSchemaPath}`])

    if (getClientEngineType() === ClientEngineType.Binary) {
      expect(result).toMatchInlineSnapshot(`

        ✔ Generated Prisma Client (v0.0.0, engine=binary) to ./subdirectory/@prisma/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './subdirectory/@prisma/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './subdirectory/@prisma/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

                                          `)
    } else {
      expect(result).toMatchInlineSnapshot(`

        ✔ Generated Prisma Client (v0.0.0) to ./subdirectory/@prisma/client in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './subdirectory/@prisma/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './subdirectory/@prisma/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

                                                `)
    }
  })

  it('--schema absolute path: should fail - invalid path', async () => {
    ctx.fixture('generate-from-parent-dir')

    const absoluteSchemaPath = path.resolve('./subdirectory/doesnotexists.prisma')
    const result = Generate.new().parse([`--schema=${absoluteSchemaPath}`])
    await expect(result).rejects.toThrow(`Provided --schema at ${absoluteSchemaPath} doesn't exist.`)
  })

  it('--generator: should work - valid generator names', async () => {
    ctx.fixture('example-project')
    const result = await Generate.new().parse([
      '--schema=./prisma/multiple-generator.prisma',
      '--generator=client',
      '--generator=client_3',
    ])

    if (getClientEngineType() === ClientEngineType.Binary) {
      expect(result).toMatchInlineSnapshot(`

        ✔ Generated Prisma Client (v0.0.0, engine=binary) to ./generated/client in XXXms

        ✔ Generated Prisma Client (v0.0.0, engine=binary) to ./generated/client_3 in XXXms

        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './generated/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './generated/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

                                          `)
    } else {
      expect(result).toMatchInlineSnapshot(`

        ✔ Generated Prisma Client (v0.0.0) to ./generated/client in XXXms

        ✔ Generated Prisma Client (v0.0.0) to ./generated/client_3 in XXXms
        
        Start using Prisma Client in Node.js (See: https://pris.ly/d/client)
        \`\`\`
        import { PrismaClient } from './generated/client'
        const prisma = new PrismaClient()
        \`\`\`
        or start using Prisma Client at the edge (See: https://pris.ly/d/accelerate)
        \`\`\`
        import { PrismaClient } from './generated/client/edge'
        const prisma = new PrismaClient()
        \`\`\`

        See other ways of importing Prisma Client: http://pris.ly/d/importing-client

                                                `)
    }
  })

  it('--generator: should fail - single invalid generator name', async () => {
    ctx.fixture('example-project')

    await expect(
      Generate.new().parse([
        '--schema=./prisma/multiple-generator.prisma',
        '--generator=client',
        '--generator=invalid_client',
      ]),
    ).rejects.toMatchInlineSnapshot(
      `The generator invalid_client specified via --generator does not exist in your Prisma schema`,
    )
  })

  it('--generator: should fail - multiple invalid generator names', async () => {
    ctx.fixture('example-project')

    await expect(
      Generate.new().parse([
        '--schema=./prisma/multiple-generator.prisma',
        '--generator=client',
        '--generator=invalid_client',
        '--generator=invalid_client_2',
      ]),
    ).rejects.toMatchInlineSnapshot(
      `The generators invalid_client, invalid_client_2 specified via --generator do not exist in your Prisma schema`,
    )
  })
})
