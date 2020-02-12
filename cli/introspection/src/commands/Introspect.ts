import { Command, format, HelpError, getSchemaPath, arg } from '@prisma/cli'
import chalk from 'chalk'
import path from 'path'
import { IntrospectionEngine, uriToCredentials, ConfigMetaFormat, RustPanic, ErrorArea } from '@prisma/sdk'
import { formatms } from '../util/formatms'
import fs from 'fs'
import { DataSource } from '@prisma/generator-helper'
import { databaseTypeToConnectorType } from '@prisma/sdk/dist/convertCredentials'
import { printDatasources } from '../prompt/utils/printDatasources'
import stripAnsi from 'strip-ansi'
import Debug from 'debug'
const debug = Debug('Introspect')

/**
 * $ prisma introspect
 */
export class Introspect implements Command {
  public static new(): Introspect {
    return new Introspect()
  }

  // static help template
  private static help = format(`
    Introspect a database and save the result to schema.prisma.

    ${chalk.bold('Usage')}

    With an existing schema.prisma
      ${chalk.dim('$')} prisma2 introspect

    Or specify a schema:
      ${chalk.dim('$')} prisma2 introspect --schema=./db/schema.prisma'

    Instead of saving the result to the filesystem, you can also print it
      ${chalk.dim('$')} prisma2 introspect --print'

  `)
  private constructor() {}
  private printUrlAsDatasource(url: string): string {
    const connectorType = databaseTypeToConnectorType(uriToCredentials(url).type)

    return printDatasources([
      {
        config: {},
        connectorType,
        name: 'db',
        url,
      },
    ])
  }

  // parse arguments
  public async parse(argv: string[], minimalOutput = false): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--url': String,
      '--print': Boolean,
      '--schema': String,
    })

    const log = (...messages) => {
      if (!args['--print']) {
        console.log(...messages)
      }
    }

    if (args instanceof Error) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    let url: string | undefined = args['--url']
    let schemaPath = await getSchemaPath(args['--schema'])
    if (!url && !schemaPath) {
      throw new Error(
        `Either provide ${chalk.greenBright(
          '--schema',
        )} or make sure that you are in a folder with a ${chalk.greenBright('schema.prisma')} file.`,
      )
    }
    // TS at its limits 🤷‍♀️
    const schema: string = url
      ? this.printUrlAsDatasource(url)
      : schemaPath
      ? fs.readFileSync(schemaPath, 'utf-8')
      : undefined!

    const engine = new IntrospectionEngine({
      cwd: schemaPath ? path.dirname(schemaPath) : undefined,
    })

    const basedOn =
      !args['--url'] && schemaPath
        ? ` based on datasource defined in ${chalk.underline(path.relative(process.cwd(), schemaPath))}`
        : ''
    log(`Introspecting${basedOn} …`)

    const before = Date.now()
    let introspectionSchema = ''
    introspectionSchema = await engine.introspect(schema)

    if (introspectionSchema.trim() === '') {
      throw new Error(`${chalk.red.bold('The introspected database was empty:')} ${chalk.underline(url)}

${chalk.bold('prisma2 introspect')} could not create any models in your ${chalk.bold(
        'schema.prisma',
      )} file and you will not be able to generate Prisma Client with the ${chalk.bold('prisma2 generate')} command.

${chalk.bold('To fix this, you have two options:')}

- manually create a table in your database (using SQL).
- make sure the database connection URL inside the ${chalk.bold('datasource')} block in ${chalk.bold(
        'schema.prisma',
      )} points to a database that is not empty (it must contain at least one table).

Then you can run ${chalk.green('prisma2 introspect')} again. 
`)
    }

    log(`Done with introspection in ${chalk.bold(formatms(Date.now() - before))}`)

    if (args['--print']) {
      console.log(introspectionSchema)
    } else {
      schemaPath = schemaPath || 'schema.prisma'
      fs.writeFileSync(schemaPath, introspectionSchema)
      log(`Wrote ${chalk.underline(path.relative(process.cwd(), schemaPath))}`)
    }

    engine.stop()

    return ''
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${Introspect.help}`)
    }
    return Introspect.help
  }
}
