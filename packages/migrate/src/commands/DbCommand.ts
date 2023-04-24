import type { Command, Commands } from '@prisma/internals'
import { arg, format, HelpError, isError, unknownCommand } from '@prisma/internals'
import { bold, dim, red } from 'kleur/colors'

export class DbCommand implements Command {
  public static new(cmds: Commands): DbCommand {
    return new DbCommand(cmds)
  }

  private static help = format(`
${process.platform === 'win32' ? '' : bold('🏋️  ')}Manage your database schema and lifecycle during development.

${bold('Usage')}

  ${dim('$')} prisma db [command] [options]

${bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema

${bold('Commands')}
     pull   Pull the state from the database to the Prisma schema using introspection
     push   Push the state from Prisma schema to the database during prototyping
     seed   Seed your database
  execute   Execute native commands to your database

${bold('Examples')}

  Run \`prisma db pull\`
  ${dim('$')} prisma db pull

  Run \`prisma db push\`
  ${dim('$')} prisma db push

  Run \`prisma db seed\`
  ${dim('$')} prisma db seed

  Run \`prisma db execute\`
  ${dim('$')} prisma db execute
`)

  private constructor(private readonly cmds: Commands) {}

  /* eslint-disable-next-line @typescript-eslint/require-await */
  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--preview-feature': Boolean,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    // display help for help flag or no subcommand
    if (args._.length === 0 || args['--help']) {
      return this.help()
    }

    // check if we have that subcommand
    const cmd = this.cmds[args._[0]]
    if (cmd) {
      const argsForCmd = args['--preview-feature'] ? [...args._.slice(1), `--preview-feature`] : args._.slice(1)
      return cmd.parse(argsForCmd)
    }

    return unknownCommand(DbCommand.help, args._[0])
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${DbCommand.help}`)
    }
    return DbCommand.help
  }
}
