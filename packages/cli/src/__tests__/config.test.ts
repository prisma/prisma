import { jestConsoleContext, jestContext } from '@prisma/get-platform'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

const COMMANDS = [
  ['validate'],
  ['migrate', 'dev'],
  ['migrate', 'status'],
  ['migrate', 'resolve'],
  ['migrate', 'reset'],
  ['migrate', 'deploy'],
  ['migrate', 'diff'],
  ['db', 'execute'],
  ['db', 'pull'],
  ['db', 'push'],
  ['db', 'seed'],
  ['studio'],
  ['generate'],
  ['version'],
  ['validate'],
  ['format'],
  ['debug'],
]

COMMANDS.forEach((command) => {
  it(`test 'prisma ${command.join(' ')}' automatically detects config file`, async () => {
    ctx.fixture('prisma-config')

    // Running with --help to not run further actions beyond config loading
    const res = await ctx.cli(...command, '--help')
    expect(res.exitCode).toBe(0)
    expect(res.stderr).toContain(`Loaded Prisma config from prisma.config.ts.`)
  })

  it(`test 'prisma ${command.join(' ')}' picks up custom --config option`, async () => {
    ctx.fixture('prisma-config-nested')

    // Running with --help to not run further actions beyond config loading
    const res = await ctx.cli(...command, '--config=./config/prisma.config.ts', '--help')
    expect(res.exitCode).toBe(0)
    expect(res.stderr).toContain(`Loaded Prisma config from config/prisma.config.ts.`)
  })
})
