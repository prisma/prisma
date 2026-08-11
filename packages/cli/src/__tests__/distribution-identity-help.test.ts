import stripAnsi from 'strip-ansi'

import { defaultTestConfig } from '../../../config/src/defaultTestConfig'
import { Bootstrap } from '../bootstrap/Bootstrap'
import { CLI } from '../CLI'
import { DebugInfo } from '../DebugInfo'
import { Format } from '../Format'
import { Generate } from '../Generate'
import { Init } from '../Init'
import { Mcp } from '../mcp/MCP'
import { Platform } from '../platform/_Platform'
import { Link } from '../postgres/link/Link'
import { PostgresCommand } from '../postgres/PostgresCommand'
import { Status } from '../Status'
import { Studio } from '../Studio'
import type { CliDistributionIdentity } from '../utils/cli-distribution-identity'
import { Validate } from '../Validate'
import { Version } from '../Version'

jest.mock('@prisma/client-generator-registry', () => ({
  defaultRegistry: {
    add: jest.fn(),
    addAliased: jest.fn(),
  },
}))

jest.mock('@prisma/migrate', () => ({
  DbSeed: class DbSeed {},
  MigrateDev: class MigrateDev {
    static new() {
      return new MigrateDev()
    }
  },
}))

function render(helpOrError: string | Error): string {
  return stripAnsi(helpOrError instanceof Error ? helpOrError.message : helpOrError)
}

function createCli(identity: CliDistributionIdentity) {
  return CLI.new(
    {
      validate: Validate.new(identity),
    },
    ['validate'],
    jest.fn(),
    identity,
  )
}

describe.each([
  { identity: 'prisma' as const, otherIdentity: 'prisma7' },
  { identity: 'prisma7' as const, otherIdentity: 'prisma' },
])('CLI-owned help uses $identity', ({ identity, otherIdentity }) => {
  test('top-level CLI help, delegated subcommand help, and lift rename guidance use the selected executable', async () => {
    const cli = createCli(identity)

    const help = render(await cli.parse([], defaultTestConfig()))
    expect(help).toContain(`$ ${identity} [command]`)
    expect(help).toContain(`$ ${identity} generate`)
    expect(help).toContain(`$ ${identity} db push`)
    expect(help).not.toContain(`$ ${otherIdentity} `)

    const validateHelp = render(await cli.parse(['validate', '--help'], defaultTestConfig()))
    expect(validateHelp).toContain(`$ ${identity} validate [options]`)
    expect(validateHelp).not.toContain(`$ ${otherIdentity} `)

    await expect(cli.parse(['lift'], defaultTestConfig())).rejects.toThrow(
      `${identity} lift has been renamed to ${identity} migrate`,
    )
  })

  test('command help and examples use the selected executable', () => {
    expect(render(Init.new(identity).help())).toContain(`$ ${identity} init --with-model`)
    expect(render(Generate.new(identity).help())).toContain(`$ ${identity} generate --watch`)
    expect(render(Validate.new(identity).help())).toContain(`$ ${identity} validate --schema=./schema.prisma`)
    expect(render(Format.new(identity).help())).toContain(`$ ${identity} format --schema=./schema.prisma`)
    expect(render(Version.new(identity).help())).toContain(`$ ${identity} version [options]`)
    expect(render(DebugInfo.new(identity).help())).toContain(`$ ${identity} debug [options]`)
    expect(render(Studio.new(identity).help())).toContain(`BROWSER=firefox ${identity} studio --port 5555`)
    expect(render(Status.new(identity).help())).toContain(`$ ${identity} platform status [options]`)
    expect(render(Bootstrap.new(identity).help())).toContain(`$ ${identity} bootstrap --template nextjs`)
    expect(render(PostgresCommand.new({ link: Link.new(identity) }, identity).help())).toContain(
      `$ ${identity} postgres link --api-key "<your-api-key>" --database "db_..."`,
    )
    expect(render(Link.new(identity).help())).toContain(`$ ${identity} postgres link`)
    expect(render(Platform.$.new({ status: Status.new(identity) }, identity).help())).toContain(
      `$ ${identity} platform status`,
    )
    expect(render(Mcp.new(identity).help())).toContain(`$ ${identity} mcp --early-access`)
  })

  test('unknown-command guidance uses the selected executable', async () => {
    const postgresHelp = render(
      await PostgresCommand.new({ link: Link.new(identity) }, identity).parse(
        ['missing'],
        defaultTestConfig(),
        process.cwd(),
      ),
    )
    expect(postgresHelp).toContain(`$ ${identity} postgres [command] [options]`)
    expect(postgresHelp).not.toContain(`$ ${otherIdentity} postgres`)

    const platformHelp = render(
      await Platform.$.new({ status: Status.new(identity) }, identity).parse(
        ['missing'],
        defaultTestConfig(),
        process.cwd(),
      ),
    )
    expect(platformHelp).toContain(`$ ${identity} platform [command]`)
    expect(platformHelp).toContain(`$ ${identity} platform status`)
    expect(platformHelp).not.toContain(`$ ${otherIdentity} platform`)
  })

  test('error wrappers keep the selected executable in appended help', () => {
    expect(render(Format.new(identity).help('format error'))).toContain(`$ ${identity} format [options]`)
    expect(render(Bootstrap.new(identity).help('bootstrap error'))).toContain(`$ ${identity} bootstrap [options]`)
    expect(render(Link.new(identity).help('link error'))).toContain(`$ ${identity} postgres link [options]`)
    expect(render(Mcp.new(identity).help('mcp error'))).toContain(`$ ${identity} mcp [options]`)
  })
})
