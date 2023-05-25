import { arg, Command, format, getSchemaPath, HelpError, isError, loadEnvFile, logger } from '@prisma/internals'
import { ArgError } from 'arg'
import { bold, dim, red, yellow } from 'kleur/colors'

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
${process.platform === 'win32' ? '' : '🙌  '}Seed your database

${bold('Usage')}

  ${dim('$')} prisma db seed [options]

${bold('Options')}

  -h, --help   Display this help message

${bold('Examples')}

  Passing extra arguments to the seed command
    ${dim('$')} prisma db seed -- --arg1 value1 --arg2 value2
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
      if (args instanceof ArgError && args.code === 'ARG_UNKNOWN_OPTION') {
        throw new Error(`${args.message}
Did you mean to pass these as arguments to your seed script? If so, add a -- separator before them:
${dim('$')} prisma db seed -- --arg1 value1 --arg2 value2`)
      }
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    if (args['--preview-feature']) {
      logger.warn(`Prisma "db seed" was in Preview and is now Generally Available.
You can now remove the ${red('--preview-feature')} flag.`)

      // Print warning if user has a "ts-node" script in their package.json, not supported anymore
      await legacyTsNodeScriptWarning()
    }

    loadEnvFile(args['--schema'], true)

    // Print warning if user is using --schema
    if (args['--schema']) {
      logger.warn(
        yellow(
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

    // We pass the extra params after a -- separator
    // Example: db seed -- --custom-param
    // Then args._ will be ['--custom-param']
    const extraArgs = args._.join(' ')

    // Seed command is set
    // Execute user seed command
    const successfulSeeding = await executeSeedCommand({ commandFromConfig: seedCommandFromPkgJson, extraArgs })
    if (successfulSeeding) {
      return `\n${process.platform === 'win32' ? '' : '🌱  '}The seed command has been executed.`
    } else {
      process.exit(1)
    }
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${DbSeed.help}`)
    }
    return DbSeed.help
  }
}
