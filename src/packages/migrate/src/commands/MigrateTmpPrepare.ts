import Debug from '@prisma/debug'
import { Command, format, getSchemaPath, HelpError } from '@prisma/sdk'
import chalk from 'chalk'
import path from 'path'
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

    const schemaPath = await getSchemaPath()

    if (!schemaPath) {
      throw new Error('Could not find a `schema.prisma` file')
    }

    console.log(
      chalk.dim(
        `Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    const migrate = new Migrate(schemaPath)

    debug('initialized migrate')

    await ensureDatabaseExists('dev', true, schemaPath)

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
