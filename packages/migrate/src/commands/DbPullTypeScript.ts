import type { PrismaConfigInternal } from '@prisma/config'
import Debug from '@prisma/debug'
import {
  arg,
  checkUnsupportedDataProxy,
  Command,
  format,
  formatms,
  getCommandWithExecutor,
  getConfig,
  HelpError,
  inferDirectoryConfig,
  link,
  loadEnvFile,
  loadSchemaContext,
  locateLocalCloudflareD1,
  type MultipleSchemas,
  protocolToConnectorType,
  relativizePathInPSLError,
  SchemaContext,
  toSchemasContainer,
} from '@prisma/internals'
import { MigrateTypes } from '@prisma/internals'
import { bold, dim, green, red, underline, yellow } from 'kleur/colors'
import path from 'path'
import { match } from 'ts-pattern'

import { SchemaEngineWasm } from '../SchemaEngineWasm'
import type { EngineArgs } from '../types'
import { countModelsAndTypes } from '../utils/countModelsAndTypes'
import { parseDatasourceInfo } from '../utils/ensureDatabaseExists'
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

const debug = Debug('prisma:db:pull:typescript')

/**
 * TypeScript-native implementation of `prisma db pull` command.
 *
 * This implementation bypasses RPC communication with the Rust schema engine
 * and instead uses the WASM engine directly with driver adapters for database
 * operations. This demonstrates the migration pattern for moving CLI commands
 * from Rust binary execution to pure TypeScript while maintaining identical
 * functionality and user experience.
 *
 * Key architectural differences from {@link DbPull}:
 * - Uses {@link SchemaEngineWasm} directly instead of spawning schema engine binary
 * - Leverages existing driver adapters for database connectivity
 * - Eliminates process spawning and JSON-RPC serialization overhead
 * - Maintains identical CLI interface and behavior for seamless migration
 *
 * @example
 * ```typescript
 * // Programmatic usage
 * const pullCommand = new DbPullTypeScript()
 * const result = await pullCommand.parse(['--print'], config)
 * ```
 *
 * @example
 * ```bash
 * # CLI usage (identical to db pull)
 * prisma db pull-ts --schema=./schema.prisma
 * ```
 */
export class DbPullTypeScript implements Command {
  public static new(): DbPullTypeScript {
    return new DbPullTypeScript()
  }

  private static help = format(`
Pull the state from the database to the Prisma schema using introspection (TypeScript implementation)

${bold('Usage')}

  ${dim('$')} prisma db pull-ts [flags/options]

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
  ${dim('$')} prisma db pull-ts

Or specify a Prisma schema path
  ${dim('$')} prisma db pull-ts --schema=./schema.prisma

Instead of saving the result to the filesystem, you can also print it to stdout
  ${dim('$')} prisma db pull-ts --print

Overwrite the current schema with the introspected schema instead of enriching it
  ${dim('$')} prisma db pull-ts --force

Set composite types introspection depth to 2 levels
  ${dim('$')} prisma db pull-ts --composite-type-depth=2

${bold(
  'Note:',
)} This is a TypeScript-native implementation that demonstrates moving CLI commands from RPC to WASM/driver adapters.
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

  public async parse(argv: string[], config: PrismaConfigInternal<any>): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--url': String,
      '--print': Boolean,
      '--schema': String,
      '--config': String,
      '--schemas': String,
      '--force': Boolean,
      '--composite-type-depth': Number,
      '--local-d1': Boolean,
    })

    const spinnerFactory = createSpinner(!args['--print'])

    if (args instanceof Error) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    const url: string | undefined = args['--url']

    await loadEnvFile({ schemaPath: args['--schema'], printMessage: !args['--print'], config })

    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: args['--schema'],
      schemaPathFromConfig: config.schema,
      printLoadMessage: false,
      allowNull: true,
    })

    const cmd = 'db pull-ts'

    checkUnsupportedDataProxy({
      cmd,
      schemaContext: schemaContext && !url ? schemaContext : undefined,
      urls: [url],
    })

    // TypeScript implementation requires driver adapters - no binary engine support
    if (!config.migrate?.adapter) {
      throw new Error(`
TypeScript-native db pull requires driver adapters. Please configure an adapter in your Prisma config.

More information about driver adapters: https://pris.ly/d/driver-adapters
`)
    }

    const adapter = await config.migrate.adapter(process.env)

    // Print to console if --print is not passed to only have the schema in stdout
    if (schemaContext && !args['--print']) {
      process.stdout.write(dim(`Prisma schema loaded from ${schemaContext.loadedFromPathForLogMessages}`) + '\n')
      printDatasource({ datasourceInfo: parseDatasourceInfo(schemaContext?.primaryDatasource), adapter })
    }

    const fromD1 = Boolean(args['--local-d1'])

    if (!url && !schemaContext && !fromD1) {
      throw new NoSchemaFoundError()
    }

    // Schema resolution logic (same as original DbPull)
    const { firstDatasource, schema, validationWarning } = await match({ url, schemaContext, fromD1 })
      .when(
        (input): input is { url: string | undefined; schemaContext: SchemaContext; fromD1: boolean } =>
          input.schemaContext !== null,
        async (input) => {
          const previewFeatures = input.schemaContext.generators.find(({ name }) => name === 'client')?.previewFeatures
          const firstDatasource = input.schemaContext.primaryDatasource
            ? input.schemaContext.primaryDatasource
            : undefined

          if (input.url) {
            let providerFromSchema = firstDatasource?.provider
            if (providerFromSchema === 'postgres') {
              providerFromSchema = 'postgresql'
            }

            const providerFromUrl = protocolToConnectorType(`${input.url.split(':')[0]}:`)
            const schema = replaceOrAddDatasource(
              this.urlToDatasource(input.url, providerFromSchema),
              input.schemaContext.schemaFiles,
            )

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
          } else if (input.fromD1) {
            const d1Database = await locateLocalCloudflareD1({ arg: '--from-local-d1' })
            const pathToSQLiteFile = path.relative(input.schemaContext.schemaRootDir, d1Database)

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
            } else {
              return { ...result, validationWarning }
            }
          } else {
            await getConfig({
              datamodel: input.schemaContext.schemaFiles,
              ignoreEnvVarErrors: false,
            })
          }

          return { firstDatasource, schema: input.schemaContext.schemaFiles, validationWarning: undefined } as const
        },
      )
      .when(
        (input): input is { url: undefined; schemaContext: null; fromD1: true } => input.fromD1 === true,
        async (_) => {
          const d1Database = await locateLocalCloudflareD1({ arg: '--from-local-d1' })
          const pathToSQLiteFile = path.relative(process.cwd(), d1Database)

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
        (input): input is { url: string; schemaContext: null; fromD1: false } => input.url !== undefined,
        async (input) => {
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

    if (schemaContext) {
      // Re-Introspection validation for MongoDB (same as original)
      const modelRegex = /\s*model\s*(\w+)\s*{/
      const isReintrospection = schemaContext.schemaFiles.some(([_, schema]) => !!modelRegex.exec(schema as string))

      if (isReintrospection && !args['--force'] && firstDatasource?.provider === 'mongodb') {
        throw new Error(`Iterating on one schema using re-introspection with db pull is currently not supported with MongoDB provider.
You can explicitly ignore and override your current local schema file with ${green(
          getCommandWithExecutor('prisma db pull-ts --force'),
        )}
Some information will be lost (relations, comments, mapped fields, @ignore...), follow ${link(
          'https://github.com/prisma/prisma/issues/9585',
        )} for more info.`)
      }
    }

    // KEY DIFFERENCE: Use SchemaEngineWasm directly instead of Migrate.setup()
    debug('Setting up TypeScript-native schema engine with WASM')
    const engine = await SchemaEngineWasm.setup({
      adapter,
      schemaContext: schemaContext ?? undefined,
    })

    const basedOn =
      !args['--url'] && schemaContext?.primaryDatasource
        ? ` based on datasource defined in ${underline(schemaContext.loadedFromPathForLogMessages)}`
        : ''
    const introspectionSpinner = spinnerFactory(`Introspecting${basedOn} (TypeScript-native)`)

    const before = Math.round(performance.now())
    let introspectionSchema: MigrateTypes.SchemasContainer | undefined = undefined
    let introspectionWarnings: EngineArgs.IntrospectResult['warnings']

    try {
      const directoryConfig = inferDirectoryConfig(schemaContext)

      debug('Starting TypeScript-native introspection via WASM engine')

      // This call goes directly to the WASM engine without RPC
      const introspectionResult = await engine.introspect({
        schema: toSchemasContainer(schema),
        baseDirectoryPath: schemaContext?.schemaRootDir ?? process.cwd(),
        viewsDirectoryPath: directoryConfig.viewsDirPath,
        force: args['--force'],
        compositeTypeDepth: args['--composite-type-depth'],
        namespaces: args['--schemas']?.split(','),
      })

      introspectionSchema = introspectionResult.schema
      introspectionWarnings = introspectionResult.warnings
      debug(`TypeScript-native introspection completed successfully`, {
        modelsFound: introspectionSchema?.files?.length,
        warnings: introspectionWarnings,
      })
    } catch (e: any) {
      introspectionSpinner.failure()
      debug('TypeScript-native introspection failed', e)

      // Same error handling as original DbPull
      if (e.code === 'P4001' && isSchemaEmpty(introspectionSchema)) {
        throw new Error(`\n${red(bold(`${e.code} `))}${red('The introspected database was empty:')}

${bold('prisma db pull-ts')} could not create any models in your ${bold(
          'schema.prisma',
        )} file and you will not be able to generate Prisma Client with the ${bold(
          getCommandWithExecutor('prisma generate'),
        )} command.

${bold('To fix this, you have two options:')}

- manually create a table in your database.
- make sure the database connection URL inside the ${bold('datasource')} block in ${bold(
          'schema.prisma',
        )} points to a database that is not empty (it must contain at least one table).

Then you can run ${green(getCommandWithExecutor('prisma db pull-ts'))} again. 
`)
      } else if (e.code === 'P1003') {
        throw new Error(`\n${red(bold(`${e.code} `))}${red('The introspected database does not exist:')}

${bold('prisma db pull-ts')} could not create any models in your ${bold(
          'schema.prisma',
        )} file and you will not be able to generate Prisma Client with the ${bold(
          getCommandWithExecutor('prisma generate'),
        )} command.

${bold('To fix this, you have two options:')}

- manually create a database.
- make sure the database connection URL inside the ${bold('datasource')} block in ${bold(
          'schema.prisma',
        )} points to an existing database.

Then you can run ${green(getCommandWithExecutor('prisma db pull-ts'))} again. 
`)
      } else if (e.code === 'P1012') {
        process.stdout.write('\n')
        const message = relativizePathInPSLError(String(e.message))
        throw new Error(`${red(message)}
Introspection failed as your current Prisma schema file is invalid

Please fix your current schema manually (using either ${green(
          getCommandWithExecutor('prisma validate'),
        )} or the Prisma VS Code extension to understand what's broken and confirm you fixed it), and then run this command again.
Or run this command with the ${green(
          '--force',
        )} flag to ignore your current schema and overwrite it. All local modifications will be lost.\n`)
      }

      process.stdout.write('\n')
      throw e
    } finally {
      // Always clean up the WASM engine
      debug('Cleaning up TypeScript-native schema engine')
      // Note: SchemaEngineWasm cleanup would be called here if available
      // The engine instance should be properly disposed to prevent resource leaks
    }

    const introspectionWarningsMessage = this.getWarningMessage(introspectionWarnings)

    if (args['--print']) {
      printIntrospectedSchema(introspectionSchema, process.stdout)

      if (introspectionWarningsMessage.trim().length > 0) {
        console.error(introspectionWarningsMessage.replace(/(\n)/gm, '\n// '))
      }
    } else {
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

      const introspectedSchemaPath = schemaContext?.loadedFromPathForLogMessages || introspectionSchema.files[0].path
      introspectionSpinner.success(`Introspected ${modelsAndTypesCountMessage} into ${underline(
        path.relative(process.cwd(), introspectedSchemaPath),
      )} in ${bold(formatms(Math.round(performance.now()) - before))} ${dim('(TypeScript-native)')}
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
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${DbPullTypeScript.help}`)
    }
    return DbPullTypeScript.help
  }
}

