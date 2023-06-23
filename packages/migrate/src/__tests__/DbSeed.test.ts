import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import execa from 'execa'

import { DbSeed } from '../commands/DbSeed'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

describe('seed', () => {
  it('seed.js', async () => {
    ctx.fixture('seed-sqlite-js')

    const result = DbSeed.new().parse([])
    await expect(result).resolves.toContain(`The seed command has been executed.`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(
      `Running seed command \`node prisma/seed.js\` ...`,
    )
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('seed.js with -- extra args should succeed', async () => {
    ctx.fixture('seed-sqlite-js-extra-args')

    const result = DbSeed.new().parse([
      '--',
      '--my-custom-arg-from-cli-1',
      'my-value',
      '--my-custom-arg-from-cli-2=my-value',
      '-z',
    ])
    await expect(result).resolves.toContain(`The seed command has been executed.`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(
      `Running seed command \`node prisma/seed.js --my-custom-arg-from-config-1 my-value --my-custom-arg-from-config-2=my-value -y --my-custom-arg-from-cli-1 my-value --my-custom-arg-from-cli-2=my-value -z\` ...`,
    )
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('seed.js with extra args but missing -- should throw with specific message', async () => {
    ctx.fixture('seed-sqlite-js-extra-args')

    const result = DbSeed.new().parse(['--my-custom-arg-from-cli=my-value', '-z'])
    await expect(result).rejects.toMatchInlineSnapshot(`
      unknown or unexpected option: --my-custom-arg-from-cli
      Did you mean to pass these as arguments to your seed script? If so, add a -- separator before them:
      $ prisma db seed -- --arg1 value1 --arg2 value2
    `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.log'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('one broken seed.js file', async () => {
    const mockExit = jest.spyOn(process, 'exit').mockImplementation((number) => {
      throw new Error('process.exit: ' + number)
    })

    ctx.fixture('seed-sqlite-js')
    ctx.fs.write('prisma/seed.js', 'BROKEN_CODE_SHOULD_ERROR;')

    const result = DbSeed.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(`process.exit: 1`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(
      `Running seed command \`node prisma/seed.js\` ...`,
    )
    expect(ctx.mocked['console.error'].mock.calls.join()).toContain('An error occurred while running the seed command:')
    expect(mockExit).toHaveBeenCalledWith(1)
  })

  it('seed.ts', async () => {
    ctx.fixture('seed-sqlite-ts')

    const result = DbSeed.new().parse([])
    await expect(result).resolves.toContain(`The seed command has been executed.`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(
      `Running seed command \`ts-node prisma/seed.ts\` ...`,
    )
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  }, 10_000)

  it('seed.ts - ESM', async () => {
    ctx.fixture('seed-sqlite-ts-esm')

    // Needs ts-node to be installed
    await execa.command('npm i')

    const result = DbSeed.new().parse([])
    await expect(result).resolves.toContain(`The seed command has been executed.`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(
      `Running seed command \`node --loader ts-node/esm prisma/seed.ts\` ...`,
    )
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)

    // "high" number since `npm install` can sometimes be very slow
  }, 60_000)

  it('seed.sh', async () => {
    ctx.fixture('seed-sqlite-sh')

    const result = DbSeed.new().parse([])
    await expect(result).resolves.toContain(`The seed command has been executed.`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(
      `Running seed command \`./prisma/seed.sh\` ...`,
    )
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })
})

describe('seed - legacy', () => {
  it('no seed file', async () => {
    ctx.fixture('seed-sqlite-legacy')
    ctx.fs.remove('prisma/seed.js')
    ctx.fs.remove('prisma/seed.ts')
    ctx.fs.remove('prisma/seed.sh')

    try {
      await DbSeed.new().parse([])
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`
        To configure seeding in your project you need to add a "prisma.seed" property in your package.json with the command to execute it:

        1. Open the package.json of your project
        2. Add one of the following examples to your package.json:

        TypeScript:
        \`\`\`
        "prisma": {
          "seed": "ts-node ./prisma/seed.ts"
        }
        \`\`\`
        If you are using ESM (ECMAScript modules):
        \`\`\`
        "prisma": {
          "seed": "node --loader ts-node/esm ./prisma/seed.ts"
        }
        \`\`\`

        And install the required dependencies by running:
        npm i -D ts-node typescript @types/node

        JavaScript:
        \`\`\`
        "prisma": {
          "seed": "node ./prisma/seed.js"
        }
        \`\`\`

        Bash:
        \`\`\`
        "prisma": {
          "seed": "./prisma/seed.sh"
        }
        \`\`\`
        And run \`chmod +x prisma/seed.sh\` to make it executable.
        More information in our documentation:
        https://pris.ly/d/seeding
      `)
    }

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('more than one seed file', async () => {
    ctx.fixture('seed-sqlite-legacy')

    const result = DbSeed.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
To configure seeding in your project you need to add a "prisma.seed" property in your package.json with the command to execute it:

1. Open the package.json of your project
2. Add the following example to it:
\`\`\`
"prisma": {
  "seed": "node prisma/seed.js"
}
\`\`\`

More information in our documentation:
https://pris.ly/d/seeding
`)

    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('deprecation of --preview-feature flag', async () => {
    ctx.fixture('seed-sqlite-js')

    const result = DbSeed.new().parse(['--preview-feature'])
    await expect(result).resolves.toContain(`The seed command has been executed.`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(
      `Running seed command \`node prisma/seed.js\` ...`,
    )
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(`
      prisma:warn Prisma "db seed" was in Preview and is now Generally Available.
      You can now remove the --preview-feature flag.
    `)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  // legacy flag should warn
  it('using --schema should warn', async () => {
    ctx.fixture('seed-sqlite-js')

    const result = DbSeed.new().parse(['--schema=./some-folder/schema.prisma'])
    await expect(result).resolves.toContain(`The seed command has been executed.`)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(
      `Running seed command \`node prisma/seed.js\` ...`,
    )
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(
      `prisma:warn The "--schema" parameter is not used anymore by "prisma db seed" since version 3.0 and can now be removed.`,
    )
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('custom --schema from package.json should enrich help setup', async () => {
    ctx.fixture('seed-sqlite-legacy-schema-from-package-json')

    const result = DbSeed.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(`
            To configure seeding in your project you need to add a "prisma.seed" property in your package.json with the command to execute it:

            1. Open the package.json of your project
            2. Add the following example to it:
            \`\`\`
            "prisma": {
              "seed": "node custom-folder/seed.js"
            }
            \`\`\`

            More information in our documentation:
            https://pris.ly/d/seeding
          `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.error'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
  })

  it('custom ts-node should warn', async () => {
    ctx.fixture('seed-sqlite-legacy-custom-ts-node')

    const result = DbSeed.new().parse([])
    await expect(result).rejects.toMatchInlineSnapshot(`
            To configure seeding in your project you need to add a "prisma.seed" property in your package.json with the command to execute it:

            1. Open the package.json of your project
            2. Add the following example to it:
            \`\`\`
            "prisma": {
              "seed": "ts-node prisma/seed.ts"
            }
            \`\`\`
            If you are using ESM (ECMAScript modules):
            \`\`\`
            "prisma": {
              "seed": "node --loader ts-node/esm prisma/seed.ts"
            }
            \`\`\`

            3. Install the required dependencies by running:
            npm i -D ts-node typescript @types/node

            More information in our documentation:
            https://pris.ly/d/seeding
          `)
    expect(ctx.mocked['console.info'].mock.calls.join('\n')).toMatchInlineSnapshot(``)
    expect(ctx.mocked['console.warn'].mock.calls.join('\n')).toMatchInlineSnapshot(
      `prisma:warn The "ts-node" script in the package.json is not used anymore since version 3.0 and can now be removed.`,
    )
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(``)
  })
})
