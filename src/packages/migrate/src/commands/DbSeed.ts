import {
  arg,
  Command,
  format,
  HelpError,
  isError,
  link,
  getSchemaPath,
  logger,
} from '@prisma/sdk'
import chalk from 'chalk'
import { PreviewFlagError } from '../utils/flagErrors'
import {
  getSeedCommandFromPackageJson,
  executeSeedCommand,
  verifySeedConfig,
  legacyTsNodeScriptWarning,
} from '../utils/seed'

export class DbSeed implements Command {
  public static new(): DbSeed {
    return new DbSeed()
  }

  private static help = format(`
${process.platform === 'win32' ? '' : chalk.bold('🙌  ')}Seed your database

${chalk.bold.yellow('WARNING')} ${chalk.bold(
    `Prisma db seed is currently in Preview (${link(
      'https://pris.ly/d/preview',
    )}).
There may be bugs and it's not recommended to use it in production environments.`,
  )}
${chalk.dim(
  'When using any of the subcommands below you need to explicitly opt-in via the --preview-feature flag.',
)}

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma db seed [options] --preview-feature

${chalk.bold('Options')}

    -h, --help   Display this help message
`)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--preview-feature': Boolean,
        '--schema': String,
        '--telemetry-information': String,
      },
      false,
    )

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    if (!args['--preview-feature']) {
      throw new PreviewFlagError()
    }

    // Print warning if user is using --schema
    if (args['--schema']) {
      logger.warn(
        chalk.yellow(
          `The "--schema" parameter is not used anymore by "prisma db seed" since 2.27.0 and can now be removed.`,
        ),
      )
    }

    // Print warning if user has a "ts-node" script in their package.json, not supported anymore
    await legacyTsNodeScriptWarning()

    const seedCommandFromPkgJson = await getSeedCommandFromPackageJson(
      process.cwd(),
    )

    if (!seedCommandFromPkgJson) {
      // Only used to help users to setup their seeds from old way to new package.json config
      const schemaPath = await getSchemaPath(args['--schema'])

      // Error because setup of the feature needs to be done
      await verifySeedConfig(schemaPath)

      return ``
    }

    // Seed command is set
    // Execute user seed command
    const successfulSeeding = await executeSeedCommand(seedCommandFromPkgJson)
    if (successfulSeeding) {
      return `\n${
        process.platform === 'win32' ? '' : '🌱  '
      }The seed command has been executed.`
    } else {
      process.exit(1)
      // For snapshot test, because exit() is mocked
      return ``
    }
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${DbSeed.help}`)
    }
    return DbSeed.help
  }
}
