import {
  arg,
  Command,
  format,
  getConfig,
  getDMMF,
  getLintWarningsAsText,
  handleLintPanic,
  HelpError,
  lintSchema,
  loadEnvFile,
  logger,
  SchemaLoader,
} from '@prisma/internals'
import { getSchemaPathAndPrint } from '@prisma/migrate'
import chalk from 'chalk'

/**
 * $ prisma validate
 */
export class Validate implements Command {
  public static new(): Validate {
    return new Validate()
  }

  private static help = format(`
Validate a Prisma schema.

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma validate [options]

${chalk.bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema

${chalk.bold('Examples')}

  With an existing Prisma schema
    ${chalk.dim('$')} prisma validate

  Or specify a Prisma schema path
    ${chalk.dim('$')} prisma validate --schema=./schema.prisma

`)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--schema': String,
      '--telemetry-information': String,
    })

    if (args instanceof Error) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    loadEnvFile(args['--schema'], true)

    const schemaPath = await getSchemaPathAndPrint(args['--schema'])

    const schemaLoader = new SchemaLoader()

    const schema = schemaLoader.loadSync(schemaPath)

    const { lintDiagnostics } = handleLintPanic(
      () => {
        // the only possible error here is a Rust panic
        const lintDiagnostics = lintSchema({ schema })
        return { lintDiagnostics }
      },
      { schema },
    )

    const lintWarnings = getLintWarningsAsText(lintDiagnostics)
    if (lintWarnings && logger.should.warn()) {
      // Output warnings to stderr
      console.warn(lintWarnings)
    }

    try {
      // Validate whether the formatted output is a valid schema
      await getDMMF({
        datamodel: schema,
      })
    } catch (e) {
      console.error('') // empty line for better readability
      throw e
    }

    // We could have a CLI flag to ignore env var validation
    await getConfig({
      datamodel: schema,
      ignoreEnvVarErrors: false,
    })

    return `The schema at ${chalk.underline(schemaPath)} is valid 🚀`
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${Validate.help}`)
    }
    return Validate.help
  }
}
