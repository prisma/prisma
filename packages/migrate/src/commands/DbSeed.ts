import { arg, Command, format, getSchemaPath, HelpError, isError, loadEnvFile } from '@prisma/internals'
import { ArgError } from 'arg'
import { bold, dim, red } from 'kleur/colors'

import { executeSeedCommand, getSeedCommandFromPackageJson, verifySeedConfigAndReturnMessage } from '../utils/seed'

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

    loadEnvFile(args['--schema'], true)

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
