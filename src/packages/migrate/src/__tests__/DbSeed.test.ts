import execa from 'execa'
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
            More than one seed file was found in \`prisma\`.
            This command only supports one seed file: Use \`seed.ts\`, \`.js\`, \`.sh\` or \`.go\`.
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
            Create a \`seed.ts\` or \`.js\` or \`.sh\` or \`.go\` file in the prisma folder.
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
            More than one seed file was found in \`prisma\`.
            This command only supports one seed file: Use \`seed.ts\`, \`.js\`, \`.sh\` or \`.go\`.
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
    ctx.fs.remove('prisma/seed.go')

    const result = DbSeed.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`

                                                                                                                                                                                                                                    🌱  Your database has been seeded.
                                                                                                                                                                                              `)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Running \`node seed.js\` ...`)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('seed.ts', async () => {
    ctx.fixture('seed-sqlite')
    ctx.fs.remove('prisma/seed.js')
    // ctx.fs.remove('prisma/seed.ts')
    ctx.fs.remove('prisma/seed.sh')
    ctx.fs.remove('prisma/seed.go')

    const result = DbSeed.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`

                        🌱  Your database has been seeded.
                    `)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Running \`ts-node seed.ts\` ...`)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })

  it('seed.sh', async () => {
    ctx.fixture('seed-sqlite')
    ctx.fs.remove('prisma/seed.js')
    ctx.fs.remove('prisma/seed.ts')
    // ctx.fs.remove('prisma/seed.sh')
    ctx.fs.remove('prisma/seed.go')

    const result = DbSeed.new().parse(['--preview-feature'])
    await expect(result).resolves.toMatchInlineSnapshot(`

                                                                                                                                                                                                                                    🌱  Your database has been seeded.
                                                                                                                                                                                              `)
    expect(
      ctx.mocked['console.info'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(`Running \`sh seed.sh\` ...`)
    expect(
      ctx.mocked['console.error'].mock.calls.join('\n'),
    ).toMatchInlineSnapshot(``)
  })
})
