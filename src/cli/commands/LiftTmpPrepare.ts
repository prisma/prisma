import { Command, format, HelpError } from '@prisma/cli'
import chalk from 'chalk'
import Debug from 'debug'
import { Lift } from '../../Lift'
import { ensureDatabaseExists } from '../../utils/ensureDatabaseExists'
import { occupyPath } from '../../utils/occupyPath'
const debug = Debug('tmp-prepare')

/**
 * $ prisma migrate new
 */
export class LiftTmpPrepare implements Command {
  public static new(): LiftTmpPrepare {
    return new LiftTmpPrepare()
  }

  // static help template
  private static help = format(`
    Watch local changes and migrate automatically

    ${chalk.bold('Usage')}

      prisma dev
  `)
  private constructor() {}

  // parse arguments
  public async parse(argv: string[]): Promise<string | Error> {
    debug('running tmp-prepare')
    await occupyPath(process.cwd())
    debug('occupied path')

    const lift = new Lift()
    debug('initialized lift')
    await ensureDatabaseExists('dev', false, true)

    await lift.up({
      short: true,
      autoApprove: true,
    })

    await lift.watchUp({
      providerAliases: {},
      autoApprove: true,
    })

    lift.stop()

    console.log('Done executing tmp prepare')
    process.exit(0)

    return ''
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${LiftTmpPrepare.help}`)
    }
    return LiftTmpPrepare.help
  }
}
