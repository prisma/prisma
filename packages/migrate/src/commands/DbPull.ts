import type { PrismaConfigInternal } from '@prisma/config'
import Debug from '@prisma/debug'
import {
  arg,
  checkUnsupportedDataProxy,
  type Command,
  format,
  formatms,
  getCommandWithExecutor,
  getConfig,
  getSchema,
  getSchemaWithPathOptional,
  HelpError,
  link,
  loadEnvFile,
  locateLocalCloudflareD1,
  type MultipleSchemas,
  protocolToConnectorType,
  relativizePathInPSLError,
  toSchemasContainer,
} from '@prisma/internals'
import type { MigrateTypes } from '@prisma/internals'
import { bold, dim, green, red, underline, yellow } from 'kleur/colors'
import path from 'node:path'
import { match } from 'ts-pattern'

import { SchemaEngine } from '../SchemaEngine'
import type { EngineArgs } from '../types'
import { countModelsAndTypes } from '../utils/countModelsAndTypes'
import { getDatasourceInfo } from '../utils/ensureDatabaseExists'
import { NoSchemaFoundError } from '../utils/errors'
import { isSchemaEmpty } from '../utils/isSchemaEmpty'
import { printDatasource } from '../utils/printDatasource'
import type { ConnectorType } from '../utils/printDatasources'
import { printDatasources } from '../utils/printDatasources'
import { printIntrospectedSchema } from '../utils/printIntrospectedSchema'
import { removeSchemaFiles } from '../utils/removeSchemaFiles'
import { replaceOrAddDatasource } from '../utils/replaceOrAddDatasource'
import { saveSchemaFiles } from '../utils/saveSchemaFiles'
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

                --config   Custom path to your Prisma config file
                --schema   Custom path to your Prisma schema
  --composite-type-depth   Specify the depth for introspecting composite types (e.g. Embedded Documents in MongoDB)
                           Number, default is -1 for infinite depth, 0 = off
               --schemas   Specify the database schemas to introspect. This overrides the schemas defined in the datasource block of your Prisma schema.
              --local-d1   Generate a Prisma schema from a local Cloudflare D1 database
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

  public async parse(argv: string[], config: PrismaConfigInternal): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--url': String,
      '--print': Boolean,
      '--schema': String,
      '--config': String,
      '--schemas': String,
      '--force': Boolean,
      '--composite-type-depth': Number, // optional, only on mongodb
      '--local-d1': Boolean, // optional, only on cloudflare D1
    })

    const spinnerFactory = createSpinner(!args['--print'])

    if (args instanceof Error) {
      return this.help(args.message)
    }

    await checkUnsupportedDataProxy('db pull', args, config.schema, !args['--url'])

    if (args['--help']) {
      return this.help()
    }

    const url: string | undefined = args['--url']
    const schemaPathResult = await getSchemaWithPathOptional(args['--schema'], config.schema)
    let schemaPath = schemaPathResult?.schemaPath ?? null
    const rootDir = schemaPathResult?.schemaRootDir ?? process.cwd()
    debug('schemaPathResult', schemaPathResult)

    // Print to console if --print is not passed to only have the schema in stdout
    if (schemaPath && !args['--print']) {
      process.stdout.write(`${dim(`Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`)}\n`)

      // Load and print where the .env was loaded (if loaded)
      await loadEnvFile({ schemaPath: args['--schema'], printMessage: true, config })

      printDatasource({ datasourceInfo: await getDatasourceInfo({ schemaPath }) })
    } else {
      // Load .env but don't print
      await loadEnvFile({ schemaPath: args['--schema'], printMessage: false, config })
    }

    const fromD1 = Boolean(args['--local-d1'])

    if (!url && !schemaPath && !fromD1) {
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
     * Note: this schema is persisted to `./schema.prisma`, rather than the canonical `./prisma/schema.prisma`.
     *
     * If neither these variables were set, we'd have already thrown a `NoSchemaFoundError`.
     */
    const { firstDatasource, schema, validationWarning } = await match({ url, schemaPath, fromD1 })
      .when(
        (input): input is { url: string | undefined; schemaPath: string; fromD1: boolean } => input.schemaPath !== null,
        async (input) => {
          const rawSchema = await getSchema(input.schemaPath, config.schema)
          const engineConfig = await getConfig({
            datamodel: rawSchema,
            ignoreEnvVarErrors: true,
          })

          const previewFeatures = engineConfig.generators.find(({ name }) => name === 'client')?.previewFeatures
          const firstDatasource = engineConfig.datasources[0] ? engineConfig.datasources[0] : undefined

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
            const schema = replaceOrAddDatasource(this.urlToDatasource(input.url, providerFromSchema), rawSchema)

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

            return { firstDatasource, schema, validationWarning: undefined }
          }if (input.fromD1) {
            const d1Database = await locateLocalCloudflareD1({ arg: '--from-local-d1' })
            const pathToSQLiteFile = path.relative(path.dirname(input.schemaPath), d1Database)

            const schema: MultipleSchemas = [
              ['schema.prisma', this.urlToDatasource(`file:${pathToSQLiteFile}`, 'sqlite')],
            ]
            const config = await getConfig({
              datamodel: schema,
              ignoreEnvVarErrors: true,
            })

            const result = { firstDatasource: config.datasources[0], schema, validationWarning: undefined }

            const hasDriverAdaptersPreviewFeature = (previewFeatures || []).includes('driverAdapters')
            const validationWarning = `Without the ${bold(
              'driverAdapters',
            )} preview feature, the schema introspected via the ${bold('--local-d1')} flag will not work with ${bold(
              '@prisma/client',
            )}.`

            if (hasDriverAdaptersPreviewFeature) {
              return result
            }
              return { ...result, validationWarning }
          }
            // Use getConfig with ignoreEnvVarErrors
            // It will  throw an error if the env var is not set or if it is invalid
            await getConfig({
              datamodel: rawSchema,
              ignoreEnvVarErrors: false,
            })

          return { firstDatasource, schema: rawSchema, validationWarning: undefined } as const
        },
      )
      .when(
        (input): input is { url: undefined; schemaPath: null; fromD1: true } => input.fromD1 === true,
        async (_) => {
          const d1Database = await locateLocalCloudflareD1({ arg: '--from-local-d1' })
          const pathToSQLiteFile = path.relative(process.cwd(), d1Database)

          // TODO: `urlToDatasource(..)` doesn't generate a `generator client` block. Should it?
          // TODO: Should we also add the `Try Prisma Accelerate` comment like we do in `prisma init`?
          const schemaContent = `generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}
${this.urlToDatasource(`file:${pathToSQLiteFile}`, 'sqlite')}`
          const schema: MultipleSchemas = [['schema.prisma', schemaContent]]
          const config = await getConfig({
            datamodel: schema,
            ignoreEnvVarErrors: true,
          })

          return { firstDatasource: config.datasources[0], schema, validationWarning: undefined }
        },
      )
      .when(
        (input): input is { url: string; schemaPath: null; fromD1: false } => input.url !== undefined,
        async (input) => {
          // protocolToConnectorType ensures that the protocol from `input.url` is valid or throws
          // TODO: better error handling with better error message
          // Related https://github.com/prisma/prisma/issues/14732
          protocolToConnectorType(`${input.url.split(':')[0]}:`)
          const schema: MultipleSchemas = [['schema.prisma', this.urlToDatasource(input.url)]]
          const config = await getConfig({
            datamodel: schema,
            ignoreEnvVarErrors: true,
          })
          return { firstDatasource: config.datasources[0], schema, validationWarning: undefined }
        },
      )
      .run()

    if (schemaPath) {
      const schemas = await getSchema(args['--schema'], config.schema)

      // Re-Introspection is not supported on MongoDB
      const modelRegex = /\s*model\s*(\w+)\s*{/
      const isReintrospection = schemas.some(([_, schema]) => !!modelRegex.exec(schema as string))

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

    const engine = new SchemaEngine({
      schemaPath: schemaPath ?? undefined,
    })

    const basedOn =
      !args['--url'] && schemaPath
        ? ` based on datasource defined in ${underline(path.relative(process.cwd(), schemaPath))}`
        : ''
    const introspectionSpinner = spinnerFactory(`Introspecting${basedOn}`)

    const before = Math.round(performance.now())
    let introspectionSchema: MigrateTypes.SchemasContainer | undefined = undefined
    let introspectionWarnings: EngineArgs.IntrospectResult['warnings']
    try {
      const introspectionResult = await engine.introspect({
        schema: toSchemasContainer(schema),
        baseDirectoryPath: rootDir,
        force: args['--force'],
        compositeTypeDepth: args['--composite-type-depth'],
        namespaces: args['--schemas']?.split(','),
      })

      introspectionSchema = introspectionResult.schema
      introspectionWarnings = introspectionResult.warnings
      debug('Introspection warnings', introspectionWarnings)
    } catch (e: any) {
      introspectionSpinner.failure()

      /**
       * Human-friendly error handling based on:
       * https://www.prisma.io/docs/reference/api-reference/error-reference
       */

      if (e.code === 'P4001' && isSchemaEmpty(introspectionSchema)) {
        /* P4001: The introspected database was empty */
        throw new Error(`\n${red(bold(`${e.code} `))}${red('The introspected database was empty:')}

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
      }if (e.code === 'P1003') {
        /* P1003: Database does not exist */
        throw new Error(`\n${red(bold(`${e.code} `))}${red('The introspected database does not exist:')}

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
      }if (e.code === 'P1012') {
        /* P1012: Schema parsing error */
        process.stdout.write('\n') // empty line

        const message = relativizePathInPSLError(e.message)

        // TODO: this error is misleading, as it gets thrown even when the schema is valid but the protocol of the given
        // '--url' argument is different than the one written in the schema.prisma file.
        // We should throw another error earlier in case the URL protocol is not compatible with the schema provider.
        throw new Error(`${red(message)}
Introspection failed as your current Prisma schema file is invalid

Please fix your current schema manually (using either ${green(
          getCommandWithExecutor('prisma validate'),
        )} or the Prisma VS Code extension to understand what's broken and confirm you fixed it), and then run this command again.
Or run this command with the ${green(
          '--force',
        )} flag to ignore your current schema and overwrite it. All local modifications will be lost.\n`)
      }

      process.stdout.write('\n') // empty line
      throw e
    }

    const introspectionWarningsMessage = this.getWarningMessage(introspectionWarnings)

    if (args['--print']) {
      printIntrospectedSchema(introspectionSchema, process.stdout)

      if (introspectionWarningsMessage.trim().length > 0) {
        // Replace make it a // comment block
        console.error(introspectionWarningsMessage.replace(/(\n)/gm, '\n// '))
      }
    } else {
      schemaPath = schemaPath || 'schema.prisma'
      if (args['--force']) {
        await removeSchemaFiles(schema)
      }
      await saveSchemaFiles(introspectionSchema)

      const { modelsCount, typesCount } = countModelsAndTypes(introspectionSchema)

      const modelsCountMessage = `${modelsCount} ${modelsCount > 1 ? 'models' : 'model'}`
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

      const renderValidationWarning = validationWarning ? `\n${yellow(validationWarning)}` : ''

      introspectionSpinner.success(`Introspected ${modelsAndTypesCountMessage} into ${underline(
        path.relative(process.cwd(), schemaPath),
      )} in ${bold(formatms(Math.round(performance.now()) - before))}
      ${yellow(introspectionWarningsMessage)}
${`Run ${green(getCommandWithExecutor('prisma generate'))} to generate Prisma Client.`}${renderValidationWarning}`)
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
      return new HelpError(`\n${bold(red('!'))} ${error}\n${DbPull.help}`)
    }
    return DbPull.help
  }
}
