import { jestConsoleContext, jestContext } from '@prisma/get-platform'
import execa from 'execa'
import path from 'path'

const ctx = jestContext.new().add(jestConsoleContext()).assemble()

function cleanSnapshot(str: string): string {
  str = str.replace(/"\/.*(\/config\/prisma.config.ts)"/g, '"REDACTED_ROOT$1"')
  str = str.replace(/"\/.*(\/prisma.config.ts)"/g, '"REDACTED_ROOT$1"')
  return str
}

const originalCwd = process.cwd()

const migrateCli = (...input: string[]) => {
  return execa.node(path.join(originalCwd, '../migrate/dist/bin.js'), input, {
    cwd: ctx.fs.cwd(),
    stdio: 'pipe',
    all: true,
  })
}

const COMMANDS = [
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
]

COMMANDS.forEach((command) => {
  it(`test 'prisma ${command.join(' ')}' automatically detects config file`, async () => {
    ctx.fixture('prisma-config')

    // Running with --help to not run further actions beyond config loading
    const res = await migrateCli(...command, '--help')
    expect(cleanSnapshot(res.stdout)).toContain(`Loaded Prisma config from "REDACTED_ROOT/prisma.config.ts".`)
  })

  it(`test 'prisma ${command.join(' ')}' picks up custom --config option`, async () => {
    ctx.fixture('prisma-config-nested')

    // Running with --help to not run further actions beyond config loading
    const res = await migrateCli(...command, '--config=./config/prisma.config.ts', '--help')
    expect(cleanSnapshot(res.stdout)).toContain(`Loaded Prisma config from "REDACTED_ROOT/config/prisma.config.ts".`)
  })
})
