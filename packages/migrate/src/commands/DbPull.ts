import type { Command, IntrospectionSchemaVersion, IntrospectionWarnings } from '@prisma/sdk'
import {
  arg,
  drawBox,
  format,
  formatms,
  getCommandWithExecutor,
  getConfig,
  getSchema,
  getSchemaPath,
  HelpError,
  IntrospectionEngine,
  link,
  loadEnvFile,
  protocolToConnectorType,
} from '@prisma/sdk'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'

import { NoSchemaFoundError } from '../utils/errors'
import { printDatasource } from '../utils/printDatasource'
import { printDatasources } from '../utils/printDatasources'
import { removeDatasource } from '../utils/removeDatasource'

export class DbPull implements Command {
  public static new(): DbPull {
    return new DbPull()
  }

  private static help = format(`
Pull the state from the database to the Prisma schema using introspection

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma db pull [options]

${chalk.bold('Options')}

  -h, --help   Display this help message
    --schema   Custom path to your Prisma schema
     --force   Ignore current Prisma schema file
     --print   Print the introspected Prisma schema to stdout

${chalk.bold('Examples')}

With an existing Prisma schema
  ${chalk.dim('$')} prisma db pull

Or specify a Prisma schema path
  ${chalk.dim('$')} prisma db pull --schema=./schema.prisma

Instead of saving the result to the filesystem, you can also print it to stdout
  ${chalk.dim('$')} prisma db pull --print

`)

  private urlToDatasource(url: string): string {
    const provider = protocolToConnectorType(`${url.split(':')[0]}:`)

    return printDatasources([
      {
        config: {},
        provider: provider,
        name: 'db',
        url,
      },
    ])
  }

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--url': String,
      '--print': Boolean,
      '--schema': String,
      '--force': Boolean,
      '--composite-type-depth': Number, // optional, only on mongodb
      // deprecated
      '--experimental-reintrospection': Boolean,
      '--clean': Boolean,
    })

    const log = (...messages): void => {
      if (!args['--print']) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        console.info(...messages)
      }
    }

    if (args instanceof Error) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    if (args['--clean'] || args['--experimental-reintrospection']) {
      const renamedMessages: string[] = []
      if (args['--experimental-reintrospection']) {
        renamedMessages.push(
          `The ${chalk.redBright(
            '--experimental-reintrospection',
          )} flag has been removed and is now the default behavior of ${chalk.greenBright('prisma db pull')}.`,
        )
      }

      if (args['--clean']) {
        renamedMessages.push(
          `The ${chalk.redBright('--clean')} flag has been renamed to ${chalk.greenBright('--force')}.`,
        )
      }

      console.error(`\n${renamedMessages.join('\n')}\n`)
      process.exit(1)
    }

    const url: string | undefined = args['--url']
    // getSchemaPathAndPrint is not flexible enough for this use case
    let schemaPath = await getSchemaPath(args['--schema'])

    // Print to console if --print is not passed to only have the schema in stdout
    if (schemaPath && !args['--print']) {
      console.info(chalk.dim(`Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`))

      // Load and print where the .env was loaded (if loaded)
      loadEnvFile(args['--schema'], true)

      await printDatasource(schemaPath)
    } else {
      // Load .env but don't print
      loadEnvFile(args['--schema'], false)
    }

    if (!url && !schemaPath) {
      throw new NoSchemaFoundError()
    }

    let schema: string | null = null

    // Makes sure we have a schema to pass to the engine
    if (url && schemaPath) {
      schema = this.urlToDatasource(url)
      const rawSchema = fs.readFileSync(schemaPath, 'utf-8')
      schema += removeDatasource(rawSchema)
    } else if (url) {
      schema = this.urlToDatasource(url)
    } else if (schemaPath) {
      schema = fs.readFileSync(schemaPath, 'utf-8')
    } else {
      throw new Error('Could not find a `schema.prisma` file')
    }

    const engine = new IntrospectionEngine({
      cwd: schemaPath ? path.dirname(schemaPath) : undefined,
    })

    const basedOn =
      !args['--url'] && schemaPath
        ? ` based on datasource defined in ${chalk.underline(path.relative(process.cwd(), schemaPath))}`
        : ''
    log(`\nIntrospecting${basedOn} …`)

    const before = Date.now()
    let introspectionSchema = ''
    let introspectionWarnings: IntrospectionWarnings[]
    let introspectionSchemaVersion: IntrospectionSchemaVersion
    try {
      const introspectionResult = await engine.introspect(schema, args['--force'], args['--composite-type-depth'])

      introspectionSchema = introspectionResult.datamodel
      introspectionWarnings = introspectionResult.warnings
      introspectionSchemaVersion = introspectionResult.version
    } catch (e: any) {
      if (e.code === 'P4001') {
        if (introspectionSchema.trim() === '') {
          throw new Error(`\n${chalk.red.bold('P4001 ')}${chalk.red('The introspected database was empty:')} ${
            url ? chalk.underline(url) : ''
          }

${chalk.bold('prisma db pull')} could not create any models in your ${chalk.bold(
            'schema.prisma',
          )} file and you will not be able to generate Prisma Client with the ${chalk.bold(
            getCommandWithExecutor('prisma generate'),
          )} command.

${chalk.bold('To fix this, you have two options:')}

- manually create a table in your database.
- make sure the database connection URL inside the ${chalk.bold('datasource')} block in ${chalk.bold(
            'schema.prisma',
          )} points to a database that is not empty (it must contain at least one table).

Then you can run ${chalk.green(getCommandWithExecutor('prisma db pull'))} again. 
`)
        }
      } else if (e.code === 'P1012') {
        // Schema Parsing Error
        console.info() // empty line
        throw new Error(`${chalk.red(`${e.code}`)} Introspection failed as your current Prisma schema file is invalid

Please fix your current schema manually, use ${chalk.green(
          getCommandWithExecutor('prisma validate'),
        )} to confirm it is valid and then run this command again.
Or run this command with the ${chalk.green(
          '--force',
        )} flag to ignore your current schema and overwrite it. All local modifications will be lost.\n`)
      }

      console.info() // empty line
      throw e
    }

    const introspectionWarningsMessage = this.getWarningMessage(introspectionWarnings) || ''

    const prisma1UpgradeMessage = introspectionSchemaVersion.includes('Prisma1')
      ? `\n${chalk.bold('Upgrading from Prisma 1 to Prisma 2+?')}
      \nThe database you introspected could belong to a Prisma 1 project.

Please run the following command to upgrade to Prisma 2+:
${chalk.green('npx prisma-upgrade [path-to-prisma-yml] [path-to-schema-prisma]')}

Note: \`prisma.yml\` and \`schema.prisma\` paths are optional.
 
Learn more about the upgrade process in the docs:\n${link('https://pris.ly/d/upgrading-to-prisma2')}
`
      : ''

    if (args['--print']) {
      console.log(introspectionSchema)
      introspectionSchemaVersion &&
        console.log(
          `\n// introspectionSchemaVersion: ${introspectionSchemaVersion}`,
          prisma1UpgradeMessage.replace(/(\n)/gm, '\n// '),
        )
      if (introspectionWarningsMessage.trim().length > 0) {
        // Replace make it a // comment block
        console.error(introspectionWarningsMessage.replace(/(\n)/gm, '\n// '))
      }
    } else {
      if (schemaPath) {
        const schema = await getSchema(args['--schema'])
        const config = await getConfig({
          datamodel: schema,
          ignoreEnvVarErrors: true,
        })

        const modelRegex = /\s*model\s*(\w+)\s*{/
        const modelMatch = modelRegex.exec(schema)
        const isReintrospection = modelMatch

        if (isReintrospection && !args['--force'] && config.datasources[0].provider === 'mongodb') {
          engine.stop()
          throw new Error(`Iterating on one schema using re-introspection with db pull is currently not supported with MongoDB provider (Preview).
You can explicitely ignore and override your current local schema file with ${chalk.green(
            getCommandWithExecutor('prisma db pull --force'),
          )}
Some information will be lost (relations, comments, mapped fields, @ignore...), follow ${link(
            'https://github.com/prisma/prisma/issues/9585',
          )} for more info.`)
        }
      }
      schemaPath = schemaPath || 'schema.prisma'
      fs.writeFileSync(schemaPath, introspectionSchema)

      const modelsCount = (introspectionSchema.match(/^model\s+/gm) || []).length

      const prisma1UpgradeMessageBox = prisma1UpgradeMessage
        ? '\n\n' +
          drawBox({
            height: 16,
            width: 74,
            str:
              prisma1UpgradeMessage +
              '\nOnce you upgraded your database schema to Prisma 2+, \ncontinue with the instructions below.\n',
            horizontalPadding: 2,
          })
        : ''

      log(`\n✔ Introspected ${modelsCount} ${
        modelsCount > 1 ? 'models and wrote them' : 'model and wrote it'
      } into ${chalk.underline(path.relative(process.cwd(), schemaPath))} in ${chalk.bold(
        formatms(Date.now() - before),
      )}${prisma1UpgradeMessageBox}
      ${chalk.keyword('orange')(introspectionWarningsMessage)}
${`Run ${chalk.green(getCommandWithExecutor('prisma generate'))} to generate Prisma Client.`}`)
    }

    engine.stop()

    return ''
  }

  private getWarningMessage(warnings: IntrospectionWarnings[]): string | undefined {
    if (warnings.length > 0) {
      let message = `\n*** WARNING ***\n`

      for (const warning of warnings) {
        message += `\n${warning.message}\n`

        if (warning.code === 0) {
          // affected === null
        } else if (warning.code === 1) {
          message += warning.affected.map((it) => `- "${it.model}"`).join('\n')
        } else if (warning.code === 2) {
          const modelsGrouped: {
            [key: string]: string[]
          } = warning.affected.reduce((acc, it) => {
            if (!acc[it.model]) {
              acc[it.model] = []
            }
            acc[it.model].push(it.field)
            return acc
          }, {})
          message += Object.entries(modelsGrouped)
            .map(([model, fields]) => `- Model: "${model}"\n  Field(s): "${fields.join('", "')}"`)
            .join('\n')
        } else if (warning.code === 3) {
          message += warning.affected
            .map((it) => `- Model "${it.model}", field: "${it.field}", original data type: "${it.tpe}"`)
            .join('\n')
        } else if (warning.code === 4) {
          message += warning.affected.map((it) => `- Enum "${it.enm}", value: "${it.value}"`).join('\n')
        } else if ([5, 6, 8, 11, 12, 13, 16].includes(warning.code)) {
          message += warning.affected.map((it) => `- Model "${it.model}", field: "${it.field}"`).join('\n')
        } else if ([7, 14, 15, 18, 19].includes(warning.code)) {
          message += warning.affected.map((it) => `- Model "${it.model}"`).join('\n')
        } else if ([9, 10].includes(warning.code)) {
          message += warning.affected.map((it) => `- Enum "${it.enm}"`).join('\n')
        } else if (warning.code === 17) {
          message += warning.affected
            .map((it) => `- Model "${it.model}", Index db name: "${it.index_db_name}"`)
            .join('\n')
        } else if (warning.code === 101) {
          message += warning.affected
            .map((it) => {
              if (it.model) {
                return `- Model "${it.model}", field: "${it.field}", chosen data type: "${it.tpe}"`
              } else if (it.compositeType) {
                return `- Type "${it.compositeType}", field: "${it.field}", chosen data type: "${it.tpe}"`
              } else {
                return `Code ${warning.code} - Properties model or compositeType don't exist in ${JSON.stringify(
                  warning.affected,
                  null,
                  2,
                )}`
              }
            })
            .join('\n')
        } else if (warning.affected) {
          // Output unhandled warning
          message += `Code ${warning.code}\n${JSON.stringify(warning.affected, null, 2)}`
        }

        message += `\n`
      }
      return message
    }

    return undefined
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${DbPull.help}`)
    }
    return DbPull.help
  }
}
