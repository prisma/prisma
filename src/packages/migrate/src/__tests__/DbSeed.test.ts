import fs from 'fs-jetpack'
import { DbSeed } from '../commands/DbSeed'
import { consoleContext, Context } from './__helpers__/context'

const ctx = Context.new().add(consoleContext()).assemble()

describe('seed', () => {
  it('requires --preview-feature flag', async () => {
    ctx.fixture('empty')

    const result = DbSeed.new().parse([])
    await expect(result).rejects.toThrowErrorMatchingInlineSnapshot(`
            This feature is currently in Preview. There may be bugs and it's not recommended to use it in production environments.
            Please provide the --preview-feature flag to use this command.
          `)
  })

  it('with missing db should fail', async () => {
    ctx.fixture('seed-sqlite')
    ctx.fs.remove('prisma/dev.db')
    ctx.fs.remove('prisma/seed.ts')

    const result = DbSeed.new().parse(['--preview-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(`
            More than one seed file was found in \`prisma\` directory.
            This command only supports one seed file: Use \`seed.ts\`, \`.js\` or \`.sh\`.
          `)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('no seed file', async () => {
    ctx.fixture('seed-sqlite')
    ctx.fs.remove('prisma/seed.js')
    ctx.fs.remove('prisma/seed.ts')
    ctx.fs.remove('prisma/seed.sh')
    ctx.fs.remove('prisma/seed.go')

    const result = DbSeed.new().parse(['--preview-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(`
            No seed file found.
            Create a \`seed.ts\`, \`.js\` or \`.sh\` file in the prisma directory.
          `)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('more than one seed file', async () => {
    ctx.fixture('seed-sqlite')

    const result = DbSeed.new().parse(['--preview-feature'])
    await expect(result).rejects.toMatchInlineSnapshot(`
            More than one seed file was found in \`prisma\` directory.
            This command only supports one seed file: Use \`seed.ts\`, \`.js\` or \`.sh\`.
          `)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('seed.js', async () => {
    ctx.fixture('seed-sqlite')
    // ctx.fs.remove('prisma/seed.js')
    ctx.fs.remove('prisma/seed.ts')
    ctx.fs.remove('prisma/seed.sh')

    const result = DbSeed.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        🌱  Your database has been seeded.
                                                                                                                                                                                                                                                                                                                                                                                                                                    `)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Running seed from "prisma/seed.js" ...`)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('seed.js seed default export', async () => {
    ctx.fixture('seed-sqlite-js-ts-default-export')
    ctx.fs.remove('prisma/seed.ts')

    const result = DbSeed.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`

                                                                                                                                                                                                                                                                                                                                                                        🌱  Your database has been seeded.
                                                                                                                                                                                                                                                                                                            `)

    expect(
      ctx.mocked['console.log'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from prisma/schema.prisma`)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Running seed from "prisma/seed.js" ...`)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('seed.js seed named export', async () => {
    ctx.fixture('seed-sqlite-js-ts-named-export')
    ctx.fs.remove('prisma/seed.ts')

    const result = DbSeed.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`

                                                                                                                                                                                                                                                                                                                                                                        🌱  Your database has been seeded.
                                                                                                                                                                                                                                                                                                            `)

    expect(
      ctx.mocked['console.log'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from prisma/schema.prisma`)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Running seed from "prisma/seed.js" ...`)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('seed.ts', async () => {
    ctx.fixture('seed-sqlite')
    ctx.fs.remove('prisma/seed.js')
    ctx.fs.remove('prisma/seed.sh')

    const result = DbSeed.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`

                                                                                                                                                                                                                                                                                                            🌱  Your database has been seeded.
                                                                                                                                                                                                                                                          `)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Running seed from prisma/seed.ts ...`)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('seed.ts seed default export', async () => {
    ctx.fixture('seed-sqlite-js-ts-default-export')
    ctx.fs.remove('prisma/seed.js')

    const result = DbSeed.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`

                                                                                                                                                                                                                                                                                                                                                                        🌱  Your database has been seeded.
                                                                                                                                                                                                                                                                                                            `)

    expect(
      ctx.mocked['console.log'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from prisma/schema.prisma`)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Running seed from prisma/seed.ts ...`)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('seed.ts seed named export', async () => {
    ctx.fixture('seed-sqlite-js-ts-named-export')
    ctx.fs.remove('prisma/seed.js')
    // ctx.fs.remove('prisma/seed.ts')

    const result = DbSeed.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`

                                                                                                                                                                                                                                                                                                                                                                        🌱  Your database has been seeded.
                                                                                                                                                                                                                                                                                                            `)

    expect(
      ctx.mocked['console.log'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Prisma schema loaded from prisma/schema.prisma`)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Running seed from prisma/seed.ts ...`)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('seed.sh', async () => {
    ctx.fixture('seed-sqlite')
    ctx.fs.remove('prisma/seed.js')
    ctx.fs.remove('prisma/seed.ts')
    // ctx.fs.remove('prisma/seed.sh')

    const result = DbSeed.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        🌱  Your database has been seeded.
                                                                                                                                                                                                                                                                                                                                                                                                                                    `)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Running seed: sh "prisma/seed.sh" ...`)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('one broken seed.js file', async () => {
    ctx.fixture('edited-and-draft')
    ctx.fs.remove('prisma/seed.js')
    ctx.fs.remove('prisma/seed.ts')
    ctx.fs.remove('prisma/seed.sh')
    fs.write('prisma/seed.js', 'BROKENCODE;;;;;')

    const result = DbSeed.new().parse(['--preview-feature'])
    await expect(result).rejects.toThrowError()
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Running seed from "prisma/seed.js" ...`)
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(
      ``,
    )
  })

  it('Custom --schema', async () => {
    ctx.fixture('seed-sqlite')

    const result = DbSeed.new().parse([
      '--schema=./some-folder/schema.prisma',
      '--preview-feature',
    ])
    await expect(result).resolves.toMatchInlineSnapshot(`

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        🌱  Your database has been seeded.
                                                                                                                                                                                                                                                                                                                                                                                                                                    `)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Running seed from "some-folder/seed.js" ...`)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('Custom --schema from package.json', async () => {
    ctx.fixture('seed-sqlite-schema-from-package-json')

    const result = DbSeed.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`

                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        🌱  Your database has been seeded.
                                                                                                                                                                                                                                                                                                                                                                                                                                    `)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Running seed from "custom-folder/seed.js" ...`)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('custom ts-node with seed.ts', async () => {
    ctx.fixture('seed-sqlite-custom-ts-node')

    const result = DbSeed.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`

                                                                                                            🌱  Your database has been seeded.
                                                                                          `)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(
      `Running seed: ts-node --compiler-options '{"module":"CommonJS"}' "prisma/seed.ts" ...`,
    )
    expect(ctx.mocked['console.error'].mock.calls.join()).toMatchInlineSnapshot(
      ``,
    )
  })
})
