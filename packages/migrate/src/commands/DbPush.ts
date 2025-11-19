import type { PrismaConfigInternal } from '@prisma/config'
import {
  arg,
  canPrompt,
  checkUnsupportedDataProxy,
  Command,
  format,
  formatms,
  getCommandWithExecutor,
  getSchemaDatasourceProvider,
  HelpError,
  inferDirectoryConfig,
  isError,
  loadSchemaContext,
  MigrateTypes,
  validatePrismaConfigWithDatasource,
} from '@prisma/internals'
import { execaNode } from 'execa'
import { bold, dim, green, italic, red, yellow } from 'kleur/colors'
import prompt from 'prompts'

import { Migrate } from '../Migrate'
import type { EngineResults } from '../types'
import { aiAgentConfirmationCheckpoint } from '../utils/ai-safety'
import { ensureDatabaseExists, parseDatasourceInfo } from '../utils/ensureDatabaseExists'
import { DbPushIgnoreWarningsWithFlagError } from '../utils/errors'
import { printDatasource } from '../utils/printDatasource'

export class DbPush implements Command {
  public static new(): DbPush {
    return new DbPush()
  }

  private static help = format(`
${process.platform === 'win32' ? '' : '🙌  '}Push the state from your Prisma schema to your database

${bold('Usage')}

  ${dim('$')} prisma db push [options]

  The datasource URL configuration is read from the Prisma config file (e.g., ${italic('prisma.config.ts')}).

${bold('Options')}

           -h, --help   Display this help message
             --config   Custom path to your Prisma config file
             --schema   Custom path to your Prisma schema
   --accept-data-loss   Ignore data loss warnings
        --force-reset   Force a reset of the database before push
            --sql      Generate typed sql module after push

${bold('Examples')}

  Push the Prisma schema state to the database
  ${dim('$')} prisma db push

  Specify a schema
  ${dim('$')} prisma db push --schema=./schema.prisma

  Ignore data loss warnings
  ${dim('$')} prisma db push --accept-data-loss
`)

  public async parse(argv: string[], config: PrismaConfigInternal, configDir: string): Promise<string | Error> {
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--accept-data-loss': Boolean,
        '--sql': Boolean,
        '--force-reset': Boolean,
        '--schema': String,
        '--config': String,
        '--telemetry-information': String,
      },
      false,
    )

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: args['--schema'],
      schemaPathFromConfig: config.schema,
    })

    const { migrationsDirPath } = inferDirectoryConfig(schemaContext, config)

    const cmd = 'db push'
    const validatedConfig = validatePrismaConfigWithDatasource({ config, cmd })

    checkUnsupportedDataProxy({ cmd, validatedConfig })

    const datasourceInfo = parseDatasourceInfo(schemaContext.primaryDatasource, validatedConfig)
    printDatasource({ datasourceInfo })
    const schemaFilter: MigrateTypes.SchemaFilter = {
      externalTables: config.tables?.external ?? [],
      externalEnums: config.enums?.external ?? [],
    }

    const migrate = await Migrate.setup({
      schemaEngineConfig: config,
      configDir,
      migrationsDirPath,
      schemaContext,
      schemaFilter,
      extensions: config['extensions'],
    })

    try {
      // Automatically create the database if it doesn't exist
      const successMessage = await ensureDatabaseExists(
        configDir,
        getSchemaDatasourceProvider(schemaContext),
        validatedConfig,
      )
      if (successMessage) {
        process.stdout.write('\n' + successMessage + '\n')
      }
    } catch (e) {
      process.stdout.write('\n') // empty line
      throw e
    }

    let wasDatabaseReset = false
    if (args['--force-reset']) {
      process.stdout.write('\n')

      aiAgentConfirmationCheckpoint()

      try {
        await migrate.reset()
      } catch (e) {
        await migrate.stop()
        throw e
      }

      let successfulResetMsg = `The ${datasourceInfo.prettyProvider} database`
      if (datasourceInfo.dbName) {
        successfulResetMsg += ` "${datasourceInfo.dbName}"`
      }

      const schemasLength = datasourceInfo.schemas?.length || 0
      // If schemas are defined in the datasource block, print them
      if (datasourceInfo.schemas && schemasLength > 0) {
        successfulResetMsg += ` schema${schemasLength > 1 ? 's' : ''} "${datasourceInfo.schemas.join(', ')}"`
      }
      // Otherwise, print the schema if it's defined in the connection string
      else if (datasourceInfo.schema) {
        successfulResetMsg += ` schema "${datasourceInfo.schema}"`
      }

      if (datasourceInfo.dbLocation) {
        successfulResetMsg += ` at "${datasourceInfo.dbLocation}"`
      }

      successfulResetMsg += ` ${schemasLength > 1 ? 'were' : 'was'} successfully reset.\n`
      process.stdout.write(successfulResetMsg)

      wasDatabaseReset = true
    }

    const before = Math.round(performance.now())
    let migration: EngineResults.SchemaPush
    try {
      migration = await migrate.push({
        force: args['--accept-data-loss'],
      })
    } catch (e) {
      await migrate.stop()
      throw e
    }

    if (migration.unexecutable && migration.unexecutable.length > 0) {
      const messages: string[] = []
      messages.push(`${bold(red('\n⚠️ We found changes that cannot be executed:\n'))}`)
      for (const item of migration.unexecutable) {
        messages.push(`  • ${item}`)
      }
      process.stdout.write('\n') // empty line

      await migrate.stop()
      throw new Error(`${messages.join('\n')}\n
You may use the --force-reset flag to drop the database before push like ${bold(
        green(getCommandWithExecutor('prisma db push --force-reset')),
      )}
${bold(red('All data will be lost.'))}
      `)
    }

    if (migration.warnings && migration.warnings.length > 0) {
      process.stdout.write(bold(yellow(`\n⚠️  There might be data loss when applying the changes:\n\n`)))

      for (const warning of migration.warnings) {
        process.stdout.write(`  • ${warning}\n\n`)
      }
      process.stdout.write('\n') // empty line

      if (!args['--accept-data-loss']) {
        if (!canPrompt()) {
          await migrate.stop()
          throw new DbPushIgnoreWarningsWithFlagError()
        }

        process.stdout.write('\n') // empty line
        const confirmation = await prompt({
          type: 'confirm',
          name: 'value',
          message: `Do you want to ignore the warning(s)?`,
        })

        if (!confirmation.value) {
          process.stdout.write('Push cancelled.\n')
          await migrate.stop()
          // Return SIGINT exit code to signal that the process was cancelled.
          process.exit(130)
        }

        try {
          await migrate.push({
            force: true,
          })
        } catch (e) {
          await migrate.stop()
          throw e
        }
      }
    }

    await migrate.stop()

    const shouldRunGenerateSql = Boolean(args['--sql'] || config.typedSql?.path)
    if (shouldRunGenerateSql) {
      const generateArgs: string[] = ['generate', '--sql']
      if (args['--schema']) {
        generateArgs.push('--schema', String(args['--schema']))
      }
      if (args['--config']) {
        generateArgs.push('--config', String(args['--config']))
      }
      if (args['--telemetry-information']) {
        generateArgs.push('--telemetry-information', String(args['--telemetry-information']))
      }
      process.stdout.write('\n')
      const generateCwd = schemaContext?.schemaRootDir ?? process.cwd()
      const env = { ...(process.env || {}) }
      const projectNodeModules = `${generateCwd}/node_modules`
      env.NODE_PATH = env.NODE_PATH ? `${projectNodeModules}:${env.NODE_PATH}` : projectNodeModules
      await execaNode(process.argv[1], generateArgs, { stdio: 'inherit', cwd: process.cwd(), env })
    }

    if (!wasDatabaseReset && migration.warnings.length === 0 && migration.executedSteps === 0) {
      process.stdout.write(`\nThe database is already in sync with the Prisma schema.\n`)
    } else {
      const migrationTimeMessage = `Done in ${formatms(Math.round(performance.now()) - before)}`
      const rocketEmoji = process.platform === 'win32' ? '' : '🚀  '
      const migrationSuccessStdMessage = 'Your database is now in sync with your Prisma schema.'
      const migrationSuccessMongoMessage = 'Your database indexes are now in sync with your Prisma schema.'

      const provider = schemaContext.primaryDatasource?.activeProvider

      process.stdout.write(
        `\n${rocketEmoji}${
          provider === 'mongodb' ? migrationSuccessMongoMessage : migrationSuccessStdMessage
        } ${migrationTimeMessage}\n`,
      )
    }

    return ``
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${DbPush.help}`)
    }
    return DbPush.help
  }
}
