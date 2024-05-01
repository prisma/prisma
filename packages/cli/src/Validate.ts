import {
  arg,
  Command,
  format,
  getConfig,
  getLintWarningsAsText,
  handleLintPanic,
  HelpError,
  lintSchema,
  loadEnvFile,
  logger,
  validate,
} from '@prisma/internals'
import { getSchemaPathAndPrint } from '@prisma/migrate'
import { bold, dim, red, underline } from 'kleur/colors'

/**
 * $ prisma validate
 */
export class Validate implements Command {
  public static new(): Validate {
    return new Validate()
  }

  private static help = format(`
Validate a Prisma schema.

${bold('Usage')}

  ${dim('$')} prisma validate [options]

${bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema

${bold('Examples')}

  With an existing Prisma schema
    ${dim('$')} prisma validate

  Or specify a Prisma schema path
    ${dim('$')} prisma validate --schema=./schema.prisma

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

    loadEnvFile({ schemaPath: args['--schema'], printMessage: true })

    const { schemaPath, files: datamodel } = await getSchemaPathAndPrint(args['--schema'])

    const { lintDiagnostics } = handleLintPanic(
      () => {
        // the only possible error here is a Rust panic
        const lintDiagnostics = lintSchema({ schema: datamodel })
        return { lintDiagnostics }
      },
      { schema: datamodel },
    )

    const lintWarnings = getLintWarningsAsText(lintDiagnostics)
    if (lintWarnings && logger.should.warn()) {
      // Output warnings to stderr
      console.warn(lintWarnings)
    }

    validate({
      datamodel,
    })

    // We could have a CLI flag to ignore env var validation
    await getConfig({
      datamodel,
      ignoreEnvVarErrors: false,
    })

    return `The schema at ${underline(schemaPath)} is valid 🚀`
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${Validate.help}`)
    }
    return Validate.help
  }
}
