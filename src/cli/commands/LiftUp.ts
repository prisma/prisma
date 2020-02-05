import { arg, Command, format, HelpError, isError } from '@prisma/cli'
import chalk from 'chalk'
import { Lift, UpOptions } from '../../Lift'
import { ensureDatabaseExists } from '../../utils/ensureDatabaseExists'
import { ExperimentalFlagError } from '../../utils/experimental'

export class LiftUp implements Command {
  public static new(): LiftUp {
    return new LiftUp()
  }

  // static help template
  private static help = format(`
    Migrate your database up to a specific state.

    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma2 migrate up [<inc|name|timestamp>] --experimental

    ${chalk.bold('Arguments')}

      [<inc>]   go up by an increment [default: latest]

    ${chalk.bold('Options')}

      --auto-approve    Skip interactive approval before migrating
      -h, --help        Displays this help message
      -p, --preview     Preview the migration changes
      -c, --create-db   Create the database in case it doesn't exist

    ${chalk.bold('Examples')}

      Create a new migration, then migrate up
      ${chalk.dim('$')} prisma2 migrate save --name "add unique to email" --experimental
      ${chalk.dim('$')} prisma2 migrate up --experimental

      Preview a migration without migrating
      ${chalk.dim('$')} prisma2 migrate up --preview --experimental

      Go up by one migration
      ${chalk.dim('$')} prisma2 migrate up 1 --experimental

      Go up by to a migration by timestamp
      ${chalk.dim('$')} prisma2 migrate up 20190605204907 --experimental

      Go up by to a migration by name
      ${chalk.dim('$')} prisma2 migrate up "add first_name field" --experimental
  `)
  private constructor() {}

  // parse arguments
  public async parse(argv: string[]): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--preview': Boolean,
      '-p': '--preview',
      '--verbose': Boolean,
      '-v': '--verbose',
      '--create-db': Boolean,
      '-c': '--create-db',
      '--auto-approve': Boolean,
      '--experimental': Boolean,
      '--schema': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    } 
    
    if (args['--help']) {
      return this.help()
    }

    if (!args['--experimental']) {
      throw new ExperimentalFlagError()
    }
    
    const lift = new Lift(args['--schema'])

    const options: UpOptions = {
      preview: args['--preview'],
      verbose: args['--verbose'],
      autoApprove: args['--auto-approve'],
    }

    if (args._.length > 0) {
      const thisArg = args._[0]
      const maybeNumber = parseInt(thisArg, 10)

      // in this case it's a migration id
      if (isNaN(maybeNumber) || typeof maybeNumber !== 'number') {
        throw new Error(`Invalid migration step ${maybeNumber}`)
      } else {
        options.n = maybeNumber
      }
    }

    await ensureDatabaseExists('apply', true, args['--create-db'], args['--schema'])

    const result = await lift.up(options)
    lift.stop()
    return result
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${LiftUp.help}`)
    }
    return LiftUp.help
  }
}
