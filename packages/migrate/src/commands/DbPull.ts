import Debug from '@prisma/debug'
import {
  arg,
  checkUnsupportedDataProxy,
  Command,
  drawBox,
  format,
  formatms,
  getCommandWithExecutor,
  getConfig,
  getSchema,
  getSchemaPath,
  HelpError,
  link,
  loadEnvFile,
  protocolToConnectorType,
} from '@prisma/internals'
import fs from 'fs'
import { bold, dim, green, red, underline, yellow } from 'kleur/colors'
import path from 'path'
import { match } from 'ts-pattern'

import { MigrateEngine } from '../MigrateEngine'
import type { EngineArgs } from '../types'
import { getDatasourceInfo } from '../utils/ensureDatabaseExists'
import { NoSchemaFoundError } from '../utils/errors'
import { printDatasource } from '../utils/printDatasource'
import type { ConnectorType } from '../utils/printDatasources'
import { printDatasources } from '../utils/printDatasources'
import { removeDatasource } from '../utils/removeDatasource'
import { createSpinner } from '../utils/spinner'

const debug = Debug('prisma:db:pull')

export class DbPull implements Command {
  public static new(): DbPull {
    return new DbPull()
  }

  private static help = format(`
Pull the state from the database to the Prisma schema using introspection

${bold('Usage')}

  ${dim('$')} prisma db pull [flags/options]

${bold('Flags')}

              -h, --help   Display this help message
                 --force   Ignore current Prisma schema file
                 --print   Print the introspected Prisma schema to stdout

${bold('Options')}

                --schema   Custom path to your Prisma schema
  --composite-type-depth   Specify the depth for introspecting composite types (e.g. Embedded Documents in MongoDB)
                           Number, default is -1 for infinite depth, 0 = off
               --schemas   Specify the database schemas to introspect. This overrides the schemas defined in the datasource block of your Prisma schema.

${bold('Examples')}

With an existing Prisma schema
  ${dim('$')} prisma db pull

Or specify a Prisma schema path
  ${dim('$')} prisma db pull --schema=./schema.prisma

Instead of saving the result to the filesystem, you can also print it to stdout
  ${dim('$')} prisma db pull --print

Overwrite the current schema with the introspected schema instead of enriching it
  ${dim('$')} prisma db pull --force

Set composite types introspection depth to 2 levels
  ${dim('$')} prisma db pull --composite-type-depth=2

`)

  private urlToDatasource(url: string, defaultProvider?: ConnectorType): string {
    const provider = defaultProvider || protocolToConnectorType(`${url.split(':')[0]}:`)
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
      '--schemas': String,
      '--force': Boolean,
      '--composite-type-depth': Number, // optional, only on mongodb
      // deprecated
      '--experimental-reintrospection': Boolean,
      '--clean': Boolean,
    })

    const spinnerFactory = createSpinner(!args['--print'])

    if (args instanceof Error) {
      return this.help(args.message)
    }

    await checkUnsupportedDataProxy('db pull', args, !args['--url'])

    if (args['--help']) {
      return this.help()
    }

    if (args['--clean'] || args['--experimental-reintrospection']) {
      const renamedMessages: string[] = []
      if (args['--experimental-reintrospection']) {
        renamedMessages.push(
          `The ${red(
            '--experimental-reintrospection',
          )} flag has been removed and is now the default behavior of ${green('prisma db pull')}.`,
        )
      }

      if (args['--clean']) {
        renamedMessages.push(`The ${red('--clean')} flag has been renamed to ${green('--force')}.`)
      }

      console.error(`\n${renamedMessages.join('\n')}\n`)
      process.exit(1)
    }

    const url: string | undefined = args['--url']
    // getSchemaPathAndPrint is not flexible enough for this use case
    let schemaPath = await getSchemaPath(args['--schema'])

    // Print to console if --print is not passed to only have the schema in stdout
    if (schemaPath && !args['--print']) {
      console.info(dim(`Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`))

      // Load and print where the .env was loaded (if loaded)
      loadEnvFile(args['--schema'], true)

      printDatasource({ datasourceInfo: await getDatasourceInfo({ schemaPath }) })
    } else {
      // Load .env but don't print
      loadEnvFile(args['--schema'], false)
    }

    if (!url && !schemaPath) {
      throw new NoSchemaFoundError()
    }

    /**
     * When `schemaPath` is set:
     * - read the schema file from disk
     * - in case `url` is also set, embed the URL to the schema's datasource without overriding the provider.
     *   This is especially useful to distinguish CockroachDB from Postgres datasources.
     *
     * When `url` is set, and `schemaPath` isn't:
     * - create a minimal schema with a datasource block from the given URL.
     *   CockroachDB URLs are however mapped to the `postgresql` provider, as those URLs are indistinguishable from Postgres URLs.
     *
     * If neither these variables were set, we'd have already thrown a `NoSchemaFoundError`.
     */
    const { firstDatasource, schema } = await match({ url, schemaPath })
      .when(
        (input): input is { url: string | undefined; schemaPath: string } => input.schemaPath !== null,
        async (input) => {
          const rawSchema = fs.readFileSync(input.schemaPath, 'utf-8')
          const config = await getConfig({
            datamodel: rawSchema,
            ignoreEnvVarErrors: true,
          })

          const firstDatasource = config.datasources[0] ? config.datasources[0] : undefined

          if (input.url) {
            let providerFromSchema = firstDatasource?.provider
            // Both postgres and postgresql are valid provider
            // We need to remove the alias for the error logic below
            if (providerFromSchema === 'postgres') {
              providerFromSchema = 'postgresql'
            }

            // protocolToConnectorType ensures that the protocol from `input.url` is valid or throws
            // TODO: better error handling with better error message
            // Related https://github.com/prisma/prisma/issues/14732
            const providerFromUrl = protocolToConnectorType(`${input.url.split(':')[0]}:`)
            const schema = `${this.urlToDatasource(input.url, providerFromSchema)}\n\n${removeDatasource(rawSchema)}`

            // if providers are different the engine would return a misleading error
            // So we check here and return a better error
            // if a combination of non compatible providers is used
            // since cockroachdb is compatible with postgresql
            // we only error if it's a different combination
            if (
              providerFromSchema &&
              providerFromUrl &&
              providerFromSchema !== providerFromUrl &&
              Boolean(providerFromSchema === 'cockroachdb' && providerFromUrl === 'postgresql') === false
            ) {
              throw new Error(
                `The database provider found in --url (${providerFromUrl}) is different from the provider found in the Prisma schema (${providerFromSchema}).`,
              )
            }

            return { firstDatasource, schema }
          } else {
            // Use getConfig with ignoreEnvVarErrors
            // It will  throw an error if the env var is not set or if it is invalid
            await getConfig({
              datamodel: rawSchema,
              ignoreEnvVarErrors: false,
            })
          }

          return { firstDatasource, schema: rawSchema }
        },
      )
      .when(
        (input): input is { url: string; schemaPath: null } => input.url !== undefined,
        async (input) => {
          // protocolToConnectorType ensures that the protocol from `input.url` is valid or throws
          // TODO: better error handling with better error message
          // Related https://github.com/prisma/prisma/issues/14732
          protocolToConnectorType(`${input.url.split(':')[0]}:`)
          const schema = this.urlToDatasource(input.url)
          const config = await getConfig({
            datamodel: schema,
            ignoreEnvVarErrors: true,
          })
          return { firstDatasource: config.datasources[0], schema }
        },
      )
      .run()

    if (schemaPath) {
      // Re-Introspection is not supported on MongoDB
      const schema = await getSchema(args['--schema'])

      const modelRegex = /\s*model\s*(\w+)\s*{/
      const modelMatch = modelRegex.exec(schema)
      const isReintrospection = modelMatch

      if (isReintrospection && !args['--force'] && firstDatasource?.provider === 'mongodb') {
        throw new Error(`Iterating on one schema using re-introspection with db pull is currently not supported with MongoDB provider.
You can explicitly ignore and override your current local schema file with ${green(
          getCommandWithExecutor('prisma db pull --force'),
        )}
Some information will be lost (relations, comments, mapped fields, @ignore...), follow ${link(
          'https://github.com/prisma/prisma/issues/9585',
        )} for more info.`)
      }
    }

    const engine = new MigrateEngine({
      projectDir: schemaPath ? path.dirname(schemaPath) : process.cwd(),
      schemaPath: schemaPath ?? undefined,
    })

    const basedOn =
      !args['--url'] && schemaPath
        ? ` based on datasource defined in ${underline(path.relative(process.cwd(), schemaPath))}`
        : ''
    const introspectionSpinner = spinnerFactory(`Introspecting${basedOn}`)

    const before = Date.now()
    let introspectionSchema = ''
    let introspectionWarnings: EngineArgs.IntrospectResult['warnings']
    let introspectionSchemaVersion: EngineArgs.IntrospectionSchemaVersion
    try {
      const introspectionResult = await engine.introspect({
        schema,
        force: args['--force'],
        compositeTypeDepth: args['--composite-type-depth'],
        schemas: args['--schemas']?.split(','),
      })

      introspectionSchema = introspectionResult.datamodel
      introspectionWarnings = introspectionResult.warnings
      debug(`Introspection warnings`, introspectionWarnings)
      introspectionSchemaVersion = introspectionResult.version
      debug(`Introspection Schema Version: ${introspectionResult.version}`)
    } catch (e: any) {
      introspectionSpinner.failure()

      /**
       * Human-friendly error handling based on:
       * https://www.prisma.io/docs/reference/api-reference/error-reference
       */

      if (e.code === 'P4001' && introspectionSchema.trim() === '') {
        /* P4001: The introspected database was empty */
        throw new Error(`\n${red(bold(`${e.code} `))}${red('The introspected database was empty:')} ${
          url ? underline(url) : ''
        }

${bold('prisma db pull')} could not create any models in your ${bold(
          'schema.prisma',
        )} file and you will not be able to generate Prisma Client with the ${bold(
          getCommandWithExecutor('prisma generate'),
        )} command.

${bold('To fix this, you have two options:')}

- manually create a table in your database.
- make sure the database connection URL inside the ${bold('datasource')} block in ${bold(
          'schema.prisma',
        )} points to a database that is not empty (it must contain at least one table).

Then you can run ${green(getCommandWithExecutor('prisma db pull'))} again. 
`)
      } else if (e.code === 'P1003') {
        /* P1003: Database does not exist */
        throw new Error(`\n${red(bold(`${e.code} `))}${red('The introspected database does not exist:')} ${
          url ? underline(url) : ''
        }

${bold('prisma db pull')} could not create any models in your ${bold(
          'schema.prisma',
        )} file and you will not be able to generate Prisma Client with the ${bold(
          getCommandWithExecutor('prisma generate'),
        )} command.

${bold('To fix this, you have two options:')}

- manually create a database.
- make sure the database connection URL inside the ${bold('datasource')} block in ${bold(
          'schema.prisma',
        )} points to an existing database.

Then you can run ${green(getCommandWithExecutor('prisma db pull'))} again. 
`)
      } else if (e.code === 'P1012') {
        /* P1012: Schema parsing error */
        console.info() // empty line

        // TODO: this error is misleading, as it gets thrown even when the schema is valid but the protocol of the given
        // '--url' argument is different than the one written in the schema.prisma file.
        // We should throw another error earlier in case the URL protocol is not compatible with the schema provider.
        throw new Error(`${red(`${e.message}`)}
Introspection failed as your current Prisma schema file is invalid

Please fix your current schema manually (using either ${green(
          getCommandWithExecutor('prisma validate'),
        )} or the Prisma VS Code extension to understand what's broken and confirm you fixed it), and then run this command again.
Or run this command with the ${green(
          '--force',
        )} flag to ignore your current schema and overwrite it. All local modifications will be lost.\n`)
      }

      console.info() // empty line
      throw e
    }

    const introspectionWarningsMessage = this.getWarningMessage(introspectionWarnings)

    const prisma1UpgradeMessage = introspectionSchemaVersion.includes('Prisma1')
      ? `\n${bold('Upgrading from Prisma 1 to Prisma 2+?')}
      \nThe database you introspected could belong to a Prisma 1 project.

Please run the following command to upgrade to Prisma 2+:
${green('npx prisma-upgrade [path-to-prisma-yml] [path-to-schema-prisma]')}

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
      schemaPath = schemaPath || 'schema.prisma'
      fs.writeFileSync(schemaPath, introspectionSchema)

      const modelsCount = (introspectionSchema.match(/^model\s+/gm) || []).length
      const modelsCountMessage = `${modelsCount} ${modelsCount > 1 ? 'models' : 'model'}`
      const typesCount = (introspectionSchema.match(/^type\s+/gm) || []).length
      const typesCountMessage = `${typesCount} ${typesCount > 1 ? 'embedded documents' : 'embedded document'}`
      let modelsAndTypesMessage: string
      if (typesCount > 0) {
        modelsAndTypesMessage = `${modelsCountMessage} and ${typesCountMessage}`
      } else {
        modelsAndTypesMessage = `${modelsCountMessage}`
      }
      const modelsAndTypesCountMessage =
        modelsCount + typesCount > 1
          ? `${modelsAndTypesMessage} and wrote them`
          : `${modelsAndTypesMessage} and wrote it`

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

      introspectionSpinner.success(`Introspected ${modelsAndTypesCountMessage} into ${underline(
        path.relative(process.cwd(), schemaPath),
      )} in ${bold(formatms(Date.now() - before))}${prisma1UpgradeMessageBox}
      ${yellow(introspectionWarningsMessage)}
${`Run ${green(getCommandWithExecutor('prisma generate'))} to generate Prisma Client.`}`)
    }

    return ''
  }

  private getWarningMessage(warnings: EngineArgs.IntrospectResult['warnings']): string {
    if (warnings) {
      return `\n${warnings}`
    }

    return ''
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${DbPull.help}`)
    }
    return DbPull.help
  }
}
