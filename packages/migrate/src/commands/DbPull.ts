import type { PrismaConfigInternal } from '@prisma/config'
import Debug from '@prisma/debug'
import {
  arg,
  checkUnsupportedDataProxy,
  checkUnsupportedSchemaEngineWasm,
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
  printSchemaLoadedMessage,
  protocolToConnectorType,
  relativizePathInPSLError,
  SchemaContext,
  toSchemasContainer,
} from '@prisma/internals'
import { MigrateTypes } from '@prisma/internals'
import { bold, dim, green, red, underline, yellow } from 'kleur/colors'
import path from 'path'
import { match } from 'ts-pattern'

import { Migrate } from '../Migrate'
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

    if (args['--help']) {
      return this.help()
    }

    loadEnvFile({ schemaPath: args['--schema'], printMessage: !args['--print'], config })

    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: args['--schema'],
      schemaPathFromConfig: config.schema,
      schemaEngineConfig: config,
      printLoadMessage: false,
      allowNull: true,
    })

    const cmd = 'db pull'

    checkUnsupportedDataProxy({
      cmd,
      schemaContext: schemaContext ?? undefined,
    })

    checkUnsupportedSchemaEngineWasm({
      cmd,
      config,
      args,
      flags: ['--local-d1'],
    })

    const adapter = config.engine === 'js' ? await config.adapter() : undefined

    // Print to console if --print is not passed to only have the schema in stdout
    if (schemaContext && !args['--print']) {
      printSchemaLoadedMessage(schemaContext.loadedFromPathForLogMessages)

      printDatasource({ datasourceInfo: parseDatasourceInfo(schemaContext?.primaryDatasource), adapter })
    }

    const fromD1 = Boolean(args['--local-d1'])

    if (!schemaContext && !fromD1) {
      throw new NoSchemaFoundError()
    }

    const { firstDatasource, schema, validationWarning } = await match({ schemaContext, fromD1 })
      .when(
        (input): input is { schemaContext: SchemaContext; fromD1: boolean } => input.schemaContext !== null,
        async (input) => {
          const firstDatasource = input.schemaContext.primaryDatasource
            ? input.schemaContext.primaryDatasource
            : undefined

          if (input.fromD1) {
            const d1Database = await locateLocalCloudflareD1({ arg: '--from-local-d1' })
            const pathToSQLiteFile = path.relative(input.schemaContext.schemaRootDir, d1Database)

            const schema: MultipleSchemas = [
              ['schema.prisma', this.urlToDatasource(`file:${pathToSQLiteFile}`, 'sqlite')],
            ]
            const config = await getConfig({
              datamodel: schema,
              ignoreEnvVarErrors: true,
            })

            return { firstDatasource: config.datasources[0], schema, validationWarning: undefined }
          } else {
            // Use getConfig with ignoreEnvVarErrors
            // It will  throw an error if the env var is not set or if it is invalid
            await getConfig({
              datamodel: input.schemaContext.schemaFiles,
              ignoreEnvVarErrors: false,
            })
          }

          return { firstDatasource, schema: input.schemaContext.schemaFiles, validationWarning: undefined } as const
        },
      )
      .when(
        (input): input is { schemaContext: null; fromD1: true } => input.fromD1 === true,
        async (_) => {
          const d1Database = await locateLocalCloudflareD1({ arg: '--from-local-d1' })
          const pathToSQLiteFile = path.relative(process.cwd(), d1Database)

          // TODO: `urlToDatasource(..)` doesn't generate a `generator client` block. Should it?
          // TODO: Should we also add the `Try Prisma Accelerate` comment like we do in `prisma init`?
          const schemaContent = `generator client {
  provider        = "prisma-client-js"
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
      .run()

    if (schemaContext) {
      // Re-Introspection is not supported on MongoDB
      const modelRegex = /\s*model\s*(\w+)\s*{/
      const isReintrospection = schemaContext.schemaFiles.some(([_, schema]) => !!modelRegex.exec(schema as string))

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

    const migrate = await Migrate.setup({
      schemaEngineConfig: config,
      schemaContext: schemaContext ?? undefined,
      extensions: config['extensions'],
    })

    const engine = migrate.engine
    const basedOn = schemaContext?.primaryDatasource
      ? ` based on datasource defined in ${underline(schemaContext.loadedFromPathForLogMessages)}`
      : ''
    const introspectionSpinner = spinnerFactory(`Introspecting${basedOn}`)

    const before = Math.round(performance.now())
    let introspectionSchema: MigrateTypes.SchemasContainer | undefined = undefined
    let introspectionWarnings: EngineArgs.IntrospectResult['warnings']
    try {
      const directoryConfig = inferDirectoryConfig(schemaContext, config)
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
      debug(`Introspection warnings`, introspectionWarnings)
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
      } else if (e.code === 'P1003') {
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
      } else if (e.code === 'P1012') {
        /* P1012: Schema parsing error */
        process.stdout.write('\n') // empty line

        const message = relativizePathInPSLError(e.message)

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
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${DbPull.help}`)
    }
    return DbPull.help
  }
}
