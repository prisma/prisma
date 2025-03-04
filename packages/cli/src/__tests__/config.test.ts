import { jestConsoleContext, jestContext } from '@prisma/get-platform'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

function cleanSnapshot(str: string): string {
  return str.replace(/\\/g, '/').replace(/".*?((\/config)?\/prisma\.config\.ts)"/g, '"REDACTED_ROOT$1"')
}

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

// Using for...of instead of forEach for better performance
for (const command of COMMANDS) {
  it(`test 'prisma ${command.join(' ')}' automatically detects config file`, async () => {
    ctx.fixture('prisma-config')

    // Running with --help to not run further actions beyond config loading
    const res = await ctx.cli(...command, '--help')
    expect(cleanSnapshot(res.stdout)).toContain(`Loaded Prisma config from "REDACTED_ROOT/prisma.config.ts".`)
  })

  it(`test 'prisma ${command.join(' ')}' picks up custom --config option`, async () => {
    ctx.fixture('prisma-config-nested')

    // Running with --help to not run further actions beyond config loading
    const res = await ctx.cli(...command, '--config=./config/prisma.config.ts', '--help')
    expect(cleanSnapshot(res.stdout)).toContain(`Loaded Prisma config from "REDACTED_ROOT/config/prisma.config.ts".`)
  })
}
