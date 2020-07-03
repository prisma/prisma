import { Command, format, HelpError } from '@prisma/sdk'
import chalk from 'chalk'
import Debug from '@prisma/debug'
import { Migrate } from '../Migrate'
import { ensureDatabaseExists } from '../utils/ensureDatabaseExists'
import { occupyPath } from '../utils/occupyPath'
const debug = Debug('tmp-prepare')

/**
 * $ prisma tmp-prepare
 */
export class MigrateTmpPrepare implements Command {
  public static new(): MigrateTmpPrepare {
    return new MigrateTmpPrepare()
  }

  // static help template
  private static help = format(`
    Watch local changes and migrate automatically

    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma migrate tmp-prepare
  `)

  // parse arguments
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async parse(argv: string[]): Promise<string | Error> {
    debug('running tmp-prepare')
    await occupyPath(process.cwd())
    debug('occupied path')

    const migrate = new Migrate()
    debug('initialized migrate')
    await ensureDatabaseExists('dev', true)

    await migrate.up({
      short: true,
      autoApprove: true,
    })

    await migrate.watchUp({
      providerAliases: {},
      autoApprove: true,
    })

    migrate.stop()

    console.log('Done executing tmp prepare')
    process.exit(0)

    return ''
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${MigrateTmpPrepare.help}`,
      )
    }
    return MigrateTmpPrepare.help
  }
}
