import type { Command } from '@prisma/sdk'
import { arg, format, getSchemaPath, HelpError, isError, loadEnvFile, logger } from '@prisma/sdk'
import chalk from 'chalk'

import {
  executeSeedCommand,
  getSeedCommandFromPackageJson,
  legacyTsNodeScriptWarning,
  verifySeedConfigAndReturnMessage,
} from '../utils/seed'

export class DbSeed implements Command {
  public static new(): DbSeed {
    return new DbSeed()
  }

  private static help = format(`
${process.platform === 'win32' ? '' : chalk.bold('🙌  ')}Seed your database

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma db seed [options]

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

    if (args['--preview-feature']) {
      logger.warn(`Prisma "db seed" was in Preview and is now Generally Available.
You can now remove the ${chalk.red('--preview-feature')} flag.`)

      // Print warning if user has a "ts-node" script in their package.json, not supported anymore
      await legacyTsNodeScriptWarning()
    }

    loadEnvFile(args['--schema'], true)

    // Print warning if user is using --schema
    if (args['--schema']) {
      logger.warn(
        chalk.yellow(
          `The "--schema" parameter is not used anymore by "prisma db seed" since version 3.0 and can now be removed.`,
        ),
      )
    }

    const seedCommandFromPkgJson = await getSeedCommandFromPackageJson(process.cwd())

    if (!seedCommandFromPkgJson) {
      // Only used to help users to set up their seeds from old way to new package.json config
      const schemaPath = await getSchemaPath(args['--schema'])

      const message = await verifySeedConfigAndReturnMessage(schemaPath)
      // Error because setup of the feature needs to be done
      if (message) {
        throw new Error(message)
      }

      return ``
    }

    // Seed command is set
    // Execute user seed command
    const successfulSeeding = await executeSeedCommand(seedCommandFromPkgJson)
    if (successfulSeeding) {
      return `\n${process.platform === 'win32' ? '' : '🌱  '}The seed command has been executed.`
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
