import {
  Command,
  format,
  HelpError,
  getSchemaPath,
  arg,
  link,
  drawBox,
} from '@prisma/sdk'
import chalk from 'chalk'
import path from 'path'
import {
  IntrospectionEngine,
  IntrospectionWarnings,
  IntrospectionSchemaVersion,
  uriToCredentials,
} from '@prisma/sdk'
import { formatms } from '../util/formatms'
import fs from 'fs'
import { databaseTypeToConnectorType } from '@prisma/sdk/dist/convertCredentials'
import { printDatasources } from '../prompt/utils/printDatasources'
import { removeDatasource } from '../util/removeDatasource'

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
      ${chalk.dim('$')} prisma introspect

    Or specify a schema:
      ${chalk.dim('$')} prisma introspect --schema=./schema.prisma'

    Instead of saving the result to the filesystem, you can also print it
      ${chalk.dim('$')} prisma introspect --print'

    ${chalk.bold('Flags')}

      --experimental-reintrospection   Enables the experimental re-introspection feature
      --clean                          Ignore current schema.prisma file when using the re-introspection feature
  `)

  private printUrlAsDatasource(url: string): string {
    const provider = databaseTypeToConnectorType(uriToCredentials(url).type)

    return printDatasources([
      {
        config: {},
        provider: [provider],
        name: 'db',
        url,
      },
    ])
  }

  // parse arguments
  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--url': String,
      '--print': Boolean,
      '--schema': String,
      '--experimental-reintrospection': Boolean,
      '--clean': Boolean,
    })

    const log = (...messages): void => {
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

    const url: string | undefined = args['--url']
    let schemaPath = await getSchemaPath(args['--schema'])
    if (!url && !schemaPath) {
      throw new Error(
        `Either provide ${chalk.greenBright('--schema')} ${chalk.bold(
          'or',
        )} make sure that you are in a folder with a ${chalk.greenBright(
          'schema.prisma',
        )} file.`,
      )
    }

    let schema: string | undefined
    if (url && schemaPath) {
      schema = this.printUrlAsDatasource(url)
      const rawSchema = fs.readFileSync(schemaPath!, 'utf-8')
      schema += removeDatasource(rawSchema)
    } else if (url) {
      schema = this.printUrlAsDatasource(url)
    } else {
      schema = fs.readFileSync(schemaPath!, 'utf-8')
    }

    const engine = new IntrospectionEngine({
      cwd: schemaPath ? path.dirname(schemaPath) : undefined,
    })

    const basedOn =
      !args['--url'] && schemaPath
        ? ` based on datasource defined in ${chalk.underline(
            path.relative(process.cwd(), schemaPath),
          )}`
        : ''
    log(`\nIntrospecting${basedOn} …`)

    const before = Date.now()
    let introspectionSchema = ''
    let introspectionWarnings: IntrospectionWarnings[]
    let introspectionSchemaVersion: IntrospectionSchemaVersion
    try {
      const introspectionResult = await engine.introspect(
        schema,
        args['--experimental-reintrospection'],
        args['--clean']
      )
      introspectionSchema = introspectionResult.datamodel
      introspectionWarnings = introspectionResult.warnings
      introspectionSchemaVersion = introspectionResult.version
    } catch (e) {
      if (e.code === 'P4001') {
        if (introspectionSchema.trim() === '') {
          throw new Error(`\n${chalk.red.bold('P4001 ')}${chalk.red(
            'The introspected database was empty:',
          )} ${url ? chalk.underline(url) : ''}

${chalk.bold(
  'prisma introspect',
)} could not create any models in your ${chalk.bold(
            'schema.prisma',
          )} file and you will not be able to generate Prisma Client with the ${chalk.bold(
            'prisma generate',
          )} command.

${chalk.bold('To fix this, you have two options:')}

- manually create a table in your database (using SQL).
- make sure the database connection URL inside the ${chalk.bold(
            'datasource',
          )} block in ${chalk.bold(
            'schema.prisma',
          )} points to a database that is not empty (it must contain at least one table).

Then you can run ${chalk.green('prisma introspect')} again. 
`)
        }
      }

      throw e
    }

    function getWarningMessage(
      warnings: IntrospectionWarnings[],
    ): string | undefined {
      if (warnings.length > 0) {
        let message = `\n*** WARNING ***\n`

        for (const warning of warnings) {
          message += `\n${warning.message}\n`

          if (warning.code === 0) {
            // affected === null
          } else if (warning.code === 1) {
            message += warning.affected
              .map((it) => `- "${it.model}"`)
              .join('\n')
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
              .map(
                ([model, fields]) =>
                  `- Model: "${model}"\n  Field(s): "${fields.join('", "')}"`,
              )
              .join('\n')
          } else if (warning.code === 3) {
            message += warning.affected
              .map(
                (it) =>
                  `- Model "${it.model}", field: "${it.field}", original data type: "${it.tpe}"`,
              )
              .join('\n')
          } else if (warning.code === 4) {
            message += warning.affected
              .map((it) => `- Enum "${it.enm}", value: "${it.value}"`)
              .join('\n')
          } else if (warning.code === 5) {
            message += warning.affected
              .map((it) => `- Model "${it.model}", field: "${it.field}"`)
              .join('\n')
          } else if (warning.code === 6) {
            message += warning.affected
              .map((it) => `- Model "${it.model}", field: "${it.field}"`)
              .join('\n')
          } else if (warning.code === 7) {
            message += warning.affected
              .map((it) => `- Model "${it.model}"`)
              .join('\n')
          } else if (warning.code === 8) {
            message += warning.affected
              .map((it) => `- Model "${it.model}", field: "${it.field}"`)
              .join('\n')
          } else if (warning.code === 9) {
            message += warning.affected
              .map((it) => `- Enum "${it.enm}"`)
              .join('\n')
          }

          message += `\n`
        }
        return message
      }
    }

    const introspectionWarningsMessage =
      getWarningMessage(introspectionWarnings) || ''

    const prisma1UpgradeMessage = introspectionSchemaVersion.includes('Prisma1')
      ? `\n${chalk.bold('Upgrading from Prisma 1 to Prisma 2')}
      \nThe database you introspected seems to belong to a Prisma 1 project.

Please run the following command to upgrade to Prisma 2.0:
${chalk.green(
  'npx prisma-upgrade [path-to-prisma-yml] [path-to-schema-prisma]',
)}

Note: \`prisma.yml\` and \`schema.prisma\` paths are optional.
 
Learn more about the upgrade process in the docs:\n${link(
          'https://pris.ly/d/upgrading-to-prisma2',
        )}`
      : ''

    const prisma1UpgradeMessageBox = prisma1UpgradeMessage
      ? '\n\n' +
        drawBox({
          height: 13,
          width: 74,
          str: prisma1UpgradeMessage,
          horizontalPadding: 2,
        })
      : ''

    if (args['--print']) {
      console.log(introspectionSchema)
      introspectionSchemaVersion &&
        console.log(
          `\n// introspectionSchemaVersion: ${introspectionSchemaVersion}`,
          prisma1UpgradeMessage.replace(/(\n)/gm, '\n// '),
        )
      if (introspectionWarningsMessage.trim().length > 0) {
        console.error(introspectionWarningsMessage)
      }
    } else {
      schemaPath = schemaPath || 'schema.prisma'
      fs.writeFileSync(schemaPath, introspectionSchema)

      const modelsCount = (introspectionSchema.match(/^model\s+/gm) || [])
        .length

      log(`\n✔ Introspected ${modelsCount} ${
        modelsCount > 1 ? 'models and wrote them' : 'model and wrote it'
      } into ${chalk.underline(
        path.relative(process.cwd(), schemaPath),
      )} in ${chalk.bold(
        formatms(Date.now() - before),
      )}${prisma1UpgradeMessageBox}
      ${chalk.keyword('orange')(introspectionWarningsMessage)}
${
  prisma1UpgradeMessage
    ? `Once you upgraded your database schema to Prisma 2.0, run ${chalk.green(
        'prisma generate',
      )} to generate Prisma Client.`
    : `Run ${chalk.green('prisma generate')} to generate Prisma Client.`
}`)
    }

    engine.stop()

    return ''
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${Introspect.help}`,
      )
    }
    return Introspect.help
  }
}
