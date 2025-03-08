import type { PrismaConfigInternal } from '@prisma/config'
import {
  arg,
  canPrompt,
  checkUnsupportedDataProxy,
  type Command,
  format,
  formatms,
  getCommandWithExecutor,
  HelpError,
  isError,
  loadEnvFile,
  protocolToConnectorType,
} from '@prisma/internals'
import { bold, dim, green, red, yellow } from 'kleur/colors'
import prompt from 'prompts'

import { Migrate } from '../Migrate'
import type { EngineResults } from '../types'
import { ensureDatabaseExists, getDatasourceInfo } from '../utils/ensureDatabaseExists'
import { DbPushIgnoreWarningsWithFlagError } from '../utils/errors'
import { getSchemaPathAndPrint } from '../utils/getSchemaPathAndPrint'
import { printDatasource } from '../utils/printDatasource'

export class DbPush implements Command {
  public static new(): DbPush {
    return new DbPush()
  }

  private static help = format(`
${process.platform === 'win32' ? '' : '🙌  '}Push the state from your Prisma schema to your database

${bold('Usage')}

  ${dim('$')} prisma db push [options]

${bold('Options')}

           -h, --help   Display this help message
             --config   Custom path to your Prisma config file
             --schema   Custom path to your Prisma schema
   --accept-data-loss   Ignore data loss warnings
        --force-reset   Force a reset of the database before push 
      --skip-generate   Skip triggering generators (e.g. Prisma Client)

${bold('Examples')}

  Push the Prisma schema state to the database
  ${dim('$')} prisma db push

  Specify a schema
  ${dim('$')} prisma db push --schema=./schema.prisma

  Ignore data loss warnings
  ${dim('$')} prisma db push --accept-data-loss
`)

  public async parse(argv: string[], config: PrismaConfigInternal): Promise<string | Error> {
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--accept-data-loss': Boolean,
        '--force-reset': Boolean,
        '--skip-generate': Boolean,
        '--schema': String,
        '--config': String,
        '--telemetry-information': String,
      },
      false,
    )

    if (isError(args)) {
      return this.help(args.message)
    }

    await checkUnsupportedDataProxy('db push', args, config.schema, true)

    if (args['--help']) {
      return this.help()
    }

    await loadEnvFile({ schemaPath: args['--schema'], printMessage: true, config })

    const { schemaPath } = await getSchemaPathAndPrint(args['--schema'], config.schema)

    const datasourceInfo = await getDatasourceInfo({ schemaPath })
    printDatasource({ datasourceInfo })

    const migrate = new Migrate(schemaPath)

    try {
      // Automatically create the database if it doesn't exist
      const wasDbCreated = await ensureDatabaseExists('push', schemaPath)
      if (wasDbCreated) {
        process.stdout.write(`\n${wasDbCreated}\n`)
      }
    } catch (e) {
      process.stdout.write('\n') // empty line
      throw e
    }

    let wasDatabaseReset = false
    if (args['--force-reset']) {
      process.stdout.write('\n')

      try {
        await migrate.reset()
      } catch (e) {
        migrate.stop()
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
      migrate.stop()
      throw e
    }

    if (migration.unexecutable && migration.unexecutable.length > 0) {
      const messages: string[] = []
      messages.push(`${bold(red('\n⚠️ We found changes that cannot be executed:\n'))}`)
      for (const item of migration.unexecutable) {
        messages.push(`  • ${item}`)
      }
      process.stdout.write('\n') // empty line

      migrate.stop()
      throw new Error(`${messages.join('\n')}\n
You may use the --force-reset flag to drop the database before push like ${bold(
        green(getCommandWithExecutor('prisma db push --force-reset')),
      )}
${bold(red('All data will be lost.'))}
      `)
    }

    if (migration.warnings && migration.warnings.length > 0) {
      process.stdout.write(bold(yellow('\n⚠️  There might be data loss when applying the changes:\n\n')))

      for (const warning of migration.warnings) {
        process.stdout.write(`  • ${warning}\n\n`)
      }
      process.stdout.write('\n') // empty line

      if (!args['--accept-data-loss']) {
        if (!canPrompt()) {
          migrate.stop()
          throw new DbPushIgnoreWarningsWithFlagError()
        }

        process.stdout.write('\n') // empty line
        const confirmation = await prompt({
          type: 'confirm',
          name: 'value',
          message: 'Do you want to ignore the warning(s)?',
        })

        if (!confirmation.value) {
          process.stdout.write('Push cancelled.\n')
          migrate.stop()
          // Return SIGINT exit code to signal that the process was cancelled.
          process.exit(130)
        }

        try {
          await migrate.push({
            force: true,
          })
        } catch (e) {
          migrate.stop()
          throw e
        }
      }
    }

    migrate.stop()

    if (!wasDatabaseReset && migration.warnings.length === 0 && migration.executedSteps === 0) {
      process.stdout.write('\nThe database is already in sync with the Prisma schema.\n')
    } else {
      const migrationTimeMessage = `Done in ${formatms(Math.round(performance.now()) - before)}`
      const rocketEmoji = process.platform === 'win32' ? '' : '🚀  '
      const migrationSuccessStdMessage = 'Your database is now in sync with your Prisma schema.'
      const migrationSuccessMongoMessage = 'Your database indexes are now in sync with your Prisma schema.'

      // this is safe, as if the protocol was unknown, we would have already exited the program with an error
      const provider = protocolToConnectorType(`${datasourceInfo.url?.split(':')[0]}:`)

      process.stdout.write(
        `\n${rocketEmoji}${
          provider === 'mongodb' ? migrationSuccessMongoMessage : migrationSuccessStdMessage
        } ${migrationTimeMessage}\n`,
      )
    }

    // Run if not skipped
    if (!process.env.PRISMA_MIGRATE_SKIP_GENERATE && !args['--skip-generate']) {
      await migrate.tryToRunGenerate(datasourceInfo)
    }

    return ''
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red('!'))} ${error}\n${DbPush.help}`)
    }
    return DbPush.help
  }
}
