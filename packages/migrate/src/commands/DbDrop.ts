import {
  arg,
  canPrompt,
  checkUnsupportedDataProxy,
  Command,
  dropDatabase,
  format,
  getSchemaDir,
  HelpError,
  isError,
  link,
  loadEnvFile,
} from '@prisma/internals'
import chalk from 'chalk'
import prompt from 'prompts'

import { getDatasourceInfo } from '../utils/ensureDatabaseExists'
import { DbNeedsForceError } from '../utils/errors'
import { PreviewFlagError } from '../utils/flagErrors'
import { getSchemaPathAndPrint } from '../utils/getSchemaPathAndPrint'
import { printDatasource } from '../utils/printDatasource'

export class DbDrop implements Command {
  public static new(): DbDrop {
    return new DbDrop()
  }

  private static help = format(`
${process.platform === 'win32' ? '' : chalk.bold('💣  ')}Drop the database

${chalk.bold.yellow('WARNING')} ${chalk.bold(
    `Prisma db drop is currently in Preview (${link('https://pris.ly/d/preview')}).
There may be bugs and it's not recommended to use it in production environments.`,
  )}
${chalk.dim('When using any of the subcommands below you need to explicitly opt-in via the --preview-feature flag.')}

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma db drop [options] --preview-feature

${chalk.bold('Options')}

   -h, --help   Display this help message
     --schema   Custom path to your Prisma schema
  -f, --force   Skip the confirmation prompt

${chalk.bold('Examples')}

  Drop the database
  ${chalk.dim('$')} prisma db drop --preview-feature

  Specify a schema
  ${chalk.dim('$')} prisma db drop --preview-feature --schema=./schema.prisma

  Use --force to skip the confirmation prompt
  ${chalk.dim('$')} prisma db drop --preview-feature --force
`)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--preview-feature': Boolean,
      '--force': Boolean,
      '-f': '--force',
      '--schema': String,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    await checkUnsupportedDataProxy('db drop', args, true)

    if (args['--help']) {
      return this.help()
    }

    if (!args['--preview-feature']) {
      throw new PreviewFlagError()
    }

    loadEnvFile(args['--schema'], true)

    const schemaPath = await getSchemaPathAndPrint(args['--schema'])

    const datasourceInfo = await getDatasourceInfo(schemaPath)
    printDatasource({ datasourceInfo })

    const schemaDir = (await getSchemaDir(schemaPath))!

    console.info() // empty line

    if (!args['--force']) {
      if (!canPrompt()) {
        throw new DbNeedsForceError('drop')
      }

      const confirmation = await prompt({
        type: 'text',
        name: 'value',
        message: `Enter the ${datasourceInfo.prettyProvider} database name "${
          datasourceInfo.dbName
        }" to drop it.\nLocation: "${datasourceInfo.dbLocation}".\n${chalk.red('All data will be lost')}.`,
      })
      console.info() // empty line

      if (!confirmation.value) {
        console.info('Drop cancelled.')
        // Return SIGINT exit code to signal that the process was cancelled.
        process.exit(130)
      } else if (confirmation.value !== datasourceInfo.dbName) {
        throw Error(`The database name entered "${confirmation.value}" doesn't match "${datasourceInfo.dbName}".`)
      }
    }

    if (await dropDatabase(datasourceInfo.url, schemaDir)) {
      return `${process.platform === 'win32' ? '' : '🚀  '}The ${datasourceInfo.prettyProvider} database "${
        datasourceInfo.dbName
      }" from "${datasourceInfo.dbLocation}" was successfully dropped.\n`
    } else {
      return ''
    }
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${DbDrop.help}`)
    }
    return DbDrop.help
  }
}
