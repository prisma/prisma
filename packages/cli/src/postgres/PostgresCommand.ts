import type { PrismaConfigInternal } from '@prisma/config'
import type { Command, Commands } from '@prisma/internals'
import { arg, format, HelpError, isError, unknownCommand } from '@prisma/internals'
import { bold, dim, red } from 'kleur/colors'

export class PostgresCommand implements Command {
  public static new(cmds: Commands): PostgresCommand {
    return new PostgresCommand(cmds)
  }

  private static help = format(`
${process.platform === 'win32' ? '' : '🐘  '}Manage Prisma Postgres databases

${bold('Usage')}

  ${dim('$')} prisma postgres [command] [options]

${bold('Options')}

  -h, --help   Display this help message

${bold('Commands')}

  link   Link a local project to a Prisma Postgres database

${bold('Examples')}

  Link your project to a Prisma Postgres database
  ${dim('$')} prisma postgres link --api-key "<your-api-key>" --database "db_..."
`)

  private constructor(private readonly cmds: Commands) {}

  public async parse(argv: string[], config: PrismaConfigInternal, baseDir: string): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args._.length === 0 || args['--help']) {
      return this.help()
    }

    const cmd = this.cmds[args._[0]]
    if (cmd) {
      return cmd.parse(args._.slice(1), config, baseDir)
    }

    return unknownCommand(PostgresCommand.help, args._[0])
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${PostgresCommand.help}`)
    }
    return PostgresCommand.help
  }
}
