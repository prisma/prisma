import {
  arg,
  Command,
  format,
  getSchemaPath,
  getSchemaDir,
  HelpError,
  isError,
  isCi,
  dropDatabase,
  link,
} from '@prisma/sdk'
import path from 'path'
import execa from 'execa'
import chalk from 'chalk'
import prompt from 'prompts'
import { getDbInfo } from '../utils/ensureDatabaseExists'
import { PreviewFlagError } from '../utils/flagErrors'
import { NoSchemaFoundError, DbNeedsForceError } from '../utils/errors'
import { printDatasource } from '../utils/printDatasource'

export class DbDrop implements Command {
  public static new(): DbDrop {
    return new DbDrop()
  }

  private static help = format(`
${process.platform === 'win32' ? '' : chalk.bold('💣  ')}Drop the database

${chalk.bold.yellow('WARNING')} ${chalk.bold(
    `Prisma db drop is currently in Preview (${link(
      'https://pris.ly/d/preview',
    )}).
There may be bugs and it's not recommended to use it in production environments.`,
  )}
${chalk.dim(
  'When using any of the subcommands below you need to explicitly opt-in via the --preview-feature flag.',
)}

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

    if (args['--help']) {
      return this.help()
    }

    if (!args['--preview-feature']) {
      throw new PreviewFlagError()
    }

    const schemaPath = await getSchemaPath(args['--schema'])

    if (!schemaPath) {
      throw new NoSchemaFoundError()
    }

    console.info(
      chalk.dim(
        `Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    await printDatasource(schemaPath)

    const dbInfo = await getDbInfo(schemaPath)
    const schemaDir = (await getSchemaDir(schemaPath))!

    console.info() // empty line

    if (!args['--force']) {
      // We use prompts.inject() for testing in our CI
      if (isCi() && Boolean((prompt as any)._injected?.length) === false) {
        throw new DbNeedsForceError('drop')
      }

      // TODO for mssql
      const confirmation = await prompt({
        type: 'text',
        name: 'value',
        message: `Enter the ${dbInfo.dbType} ${dbInfo.schemaWord} name "${
          dbInfo.dbName
        }" to drop it.\nLocation: "${dbInfo.dbLocation}".\n${chalk.red(
          'All data will be lost',
        )}.`,
      })
      console.info() // empty line

      if (!confirmation.value) {
        console.info('Drop cancelled.')
        process.exit(0)
      } else if (confirmation.value !== dbInfo.dbName) {
        throw Error(
          `The ${dbInfo.schemaWord} name entered "${confirmation.value}" doesn't match "${dbInfo.dbName}".`,
        )
      }
    }

    if (await dropDatabase(dbInfo.url, schemaDir)) {
      return `${process.platform === 'win32' ? '' : '🚀  '}The ${
        dbInfo.dbType
      } ${dbInfo.schemaWord} "${dbInfo.dbName}" from "${
        dbInfo.dbLocation
      }" was successfully dropped.\n`
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
