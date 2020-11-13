import {
  arg,
  Command,
  format,
  getCommandWithExecutor,
  getSchemaPath,
  getSchemaDir,
  HelpError,
  isError,
  isCi,
  uriToCredentials,
  getConfig,
  dropDatabase,
  link,
} from '@prisma/sdk'
import path from 'path'
import fs from 'fs'
import execa from 'execa'
import chalk from 'chalk'
import prompt from 'prompts'
import {
  getDbinfoFromCredentials,
  getDbLocation,
} from '../utils/ensureDatabaseExists'
import { PreviewFlagError } from '../utils/flagErrors'

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

   -h, --help      Display this help message
  -f, --force      Skip the confirmation prompt

${chalk.bold('Examples')}

  Drop the database
  ${chalk.dim('$')} prisma db drop --preview-feature

  Specify a schema
  ${chalk.dim('$')} prisma db drop --preview-feature --schema=./schema.prisma'

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
      throw new Error(
        `Could not find a ${chalk.bold(
          'schema.prisma',
        )} file that is required for this command.\nYou can either provide it with ${chalk.greenBright(
          '--schema',
        )}, set it as \`prisma.schema\` in your package.json or put it into the default location ${chalk.greenBright(
          './prisma/schema.prisma',
        )} https://pris.ly/d/prisma-schema-location`,
      )
    }

    console.info(
      chalk.dim(
        `Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    const datamodel = fs.readFileSync(schemaPath, 'utf-8')
    const config = await getConfig({ datamodel })
    const activeDatasource = config.datasources[0]
    const credentials = uriToCredentials(activeDatasource.url.value)
    const { schemaWord, dbType, dbName } = getDbinfoFromCredentials(credentials)
    const schemaDir = (await getSchemaDir(schemaPath))!

    console.info() // empty line

    if (!args['--force']) {
      // We use prompts.inject() for testing in our CI
      if (isCi() && Boolean((prompt as any)._injected?.length) === false) {
        throw Error(
          `Use the --force flag to use the drop command in an unnattended environment like ${chalk.bold.greenBright(
            getCommandWithExecutor('prisma db drop --preview-feature --force'),
          )}`,
        )
      }

      const confirmation = await prompt({
        type: 'text',
        name: 'value',
        message: `Enter the ${dbType} ${schemaWord} name "${dbName}" to drop it.\nLocation: "${getDbLocation(
          credentials,
        )}".\n${chalk.red('All data will be lost')}.`,
      })
      console.info() // empty line

      if (!confirmation.value) {
        console.info('Drop cancelled.')
        process.exit(0)
      } else if (confirmation.value !== dbName) {
        throw Error(
          `The ${schemaWord} name entered "${confirmation.value}" doesn't match "${dbName}".`,
        )
      }
    }

    let result: execa.ExecaReturnValue<string> | undefined = undefined
    try {
      result = await dropDatabase(activeDatasource.url.value, schemaDir)
    } catch (e) {
      let json
      try {
        json = JSON.parse(e.stdout)
      } catch (e) {
        console.error(
          `Could not parse database drop engine response: ${e.stdout.slice(
            0,
            200,
          )}`,
        )
      }

      if (json.message) {
        throw Error(json.message)
      }

      throw Error(e)
    }

    if (
      result &&
      result.exitCode === 0 &&
      result.stderr.includes('The database was successfully dropped')
    ) {
      return `${
        process.platform === 'win32' ? '' : '🚀  '
      }The ${dbType} ${schemaWord} "${dbName}" from "${getDbLocation(
        credentials,
      )}" was successfully dropped.\n`
    } else {
      // We should not arrive here normally
      throw Error(
        `An error occurred during the drop: ${JSON.stringify(
          result,
          undefined,
          2,
        )}`,
      )
    }
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${DbDrop.help}`)
    }
    return DbDrop.help
  }
}
