import path from 'node:path'

import type { PrismaConfigInternal } from '@prisma/config'
import {
  arg,
  type Command,
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
    --config   Custom path to your Prisma config file
    --schema   Custom path to your Prisma schema

${bold('Examples')}

  With an existing Prisma schema
    ${dim('$')} prisma validate

  With a Prisma config file
    ${dim('$')} prisma validate --config=./prisma.config.ts

  Or specify a Prisma schema path
    ${dim('$')} prisma validate --schema=./schema.prisma

`)

  public async parse(argv: string[], config: PrismaConfigInternal): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--schema': String,
      '--config': String,
      '--telemetry-information': String,
    })

    if (args instanceof Error) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    await loadEnvFile({ schemaPath: args['--schema'], printMessage: true, config })

    const { schemaPath, schemas } = await getSchemaPathAndPrint(args['--schema'], config.schema)

    const { lintDiagnostics } = handleLintPanic(
      () => {
        // the only possible error here is a Rust panic
        const lintDiagnostics = lintSchema({ schemas })
        return { lintDiagnostics }
      },
      { schemas },
    )

    const lintWarnings = getLintWarningsAsText(lintDiagnostics)
    if (lintWarnings && logger.should.warn()) {
      // Output warnings to stderr
      console.warn(lintWarnings)
    }

    validate({
      schemas,
    })

    // We could have a CLI flag to ignore env var validation
    await getConfig({
      datamodel: schemas,
      ignoreEnvVarErrors: false,
    })

    const schemaRelativePath = path.relative(process.cwd(), schemaPath)

    if (schemas.length > 1) {
      return `The schemas at ${underline(schemaRelativePath)} are valid 🚀`
    }

    return `The schema at ${underline(schemaRelativePath)} is valid 🚀`
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red('!'))} ${error}\n${Validate.help}`)
    }
    return Validate.help
  }
}
