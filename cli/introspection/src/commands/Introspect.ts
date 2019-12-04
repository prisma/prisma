import { Command, format, HelpError, getSchemaPath, arg } from '@prisma/cli'
import chalk from 'chalk'
import path from 'path'
import { getConfig, IntrospectionEngine, getDMMF, dmmfToDml } from '@prisma/sdk'
import { formatms } from '../util/formatms'
import fs from 'fs'
import { ConfigMetaFormat } from '@prisma/sdk/dist/isdlToDatamodel2'

/**
 * $ prisma migrate new
 */
export class Introspect implements Command {
  public static new(): Introspect {
    return new Introspect()
  }

  // static help template
  private static help = format(`
    Introspect a database and save the result to schema.prisma.

    ${chalk.bold('Usage')}

    With an existing schema.prisma, just
      ${chalk.bold('prisma2 introspect')}
    
    Or specify a connection string:
      ${chalk.bold('prisma2 introspect --url="mysql://localhost:3306/database"')}
    
    Instead of saving the result to the filesystem, you can also just print it
      ${chalk.bold('prisma2 introspect --print')}

  `)
  private constructor() {}

  // parse arguments
  public async parse(argv: string[], minimalOutput = false): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--url': String,
      '--print': Boolean,
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
    let schemaPath = await getSchemaPath()
    let config: ConfigMetaFormat | undefined
    if (!url) {
      if (!schemaPath) {
        throw new Error(
          `Either provide ${chalk.greenBright(
            '--url',
          )} or make sure that you are in a folder with a ${chalk.greenBright('schema.prisma')} file.`,
        )
      }

      config = await getConfig({
        datamodelPath: schemaPath,
      })

      const datasource = config.datasources[0]
      if (!datasource) {
        throw new Error(
          `Either provide ${chalk.greenBright('--url')} or add a ${chalk.greenBright.bold(
            'datasource',
          )} in the ${chalk.greenBright(path.relative(process.cwd(), schemaPath))} file.`,
        )
      }
      url = datasource.url.value
    }

    const engine = new IntrospectionEngine({
      cwd: schemaPath ? path.dirname(schemaPath) : undefined,
    })

    const basedOn =
      !args['--url'] && schemaPath
        ? ` based on datasource defined in ${chalk.underline(path.relative(process.cwd(), schemaPath))}`
        : ''
    log(`Introspecting${basedOn} …`)

    const before = Date.now()
    const introspectionSchema = await engine.introspect(url)
    engine.stop()

    if (introspectionSchema.trim() === '') {
      throw new Error(`Empty introspection result for ${chalk.underline(url)}`)
    }

    try {
      const dmmf = await getDMMF({ datamodel: introspectionSchema })
      const schema = await dmmfToDml({
        config: config || {
          datasources: [],
          generators: [],
        },
        dmmf: dmmf.datamodel,
      })

      log(`Done with introspection in ${chalk.bold(formatms(Date.now() - before))}`)

      if (args['--print']) {
        console.log(schema)
      } else {
        if (schemaPath && fs.existsSync(schemaPath)) {
          const backupPath = path.join(path.dirname(schemaPath), 'schema.backup.prisma')
          fs.renameSync(schemaPath, backupPath)
          log(
            `\nMoved existing ${chalk.underline(path.relative(process.cwd(), schemaPath))} to ${chalk.underline(
              path.relative(process.cwd(), backupPath),
            )}`,
          )
        }
        schemaPath = schemaPath || 'schema.prisma'
        fs.writeFileSync(schemaPath, schema)
        log(`Wrote ${chalk.underline(path.relative(process.cwd(), schemaPath))}`)
      }
    } catch (e) {
      console.error(chalk.bold.red(`\nIntrospection failed:`) + chalk.red(` Introspected schema can't be parsed.`))
      if (introspectionSchema) {
        console.log(chalk.bold(`Introspected Schema:\n`))
        console.log(introspectionSchema + '\n')
      }
      console.error(e)
    }

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
