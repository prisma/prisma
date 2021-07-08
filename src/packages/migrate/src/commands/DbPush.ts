import {
  arg,
  Command,
  format,
  HelpError,
  isError,
  getSchemaPath,
  logger,
  isCi,
  getCommandWithExecutor,
} from '@prisma/sdk'
import path from 'path'
import chalk from 'chalk'
import prompt from 'prompts'
import { Migrate } from '../Migrate'
import { ensureDatabaseExists, getDbInfo } from '../utils/ensureDatabaseExists'
import { formatms } from '../utils/formatms'
import {
  DbPushIgnoreWarningsWithFlagError,
  DbPushForceFlagRenamedError,
  NoSchemaFoundError,
} from '../utils/errors'
import { printDatasource } from '../utils/printDatasource'
import { EngineResults } from '../types'

export class DbPush implements Command {
  public static new(): DbPush {
    return new DbPush()
  }

  private static help = format(`
${
  process.platform === 'win32' ? '' : chalk.bold('🙌  ')
}Push the state from your Prisma schema to your database

${chalk.bold('Usage')}

  ${chalk.dim('$')} prisma db push [options]

${chalk.bold('Options')}

           -h, --help   Display this help message
             --schema   Custom path to your Prisma schema
   --accept-data-loss   Ignore data loss warnings
        --force-reset   Force a reset of the database before push 
      --skip-generate   Skip triggering generators (e.g. Prisma Client)

${chalk.bold('Examples')}

  Push the Prisma schema state to the database
  ${chalk.dim('$')} prisma db push

  Specify a schema
  ${chalk.dim('$')} prisma db push --schema=./schema.prisma

  Ignore data loss warnings
  ${chalk.dim('$')} prisma db push --accept-data-loss
`)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--preview-feature': Boolean,
        '--accept-data-loss': Boolean,
        '--force-reset': Boolean,
        '--skip-generate': Boolean,
        '--schema': String,
        '--telemetry-information': String,
        // Deprecated
        // --force renamed to --accept-data-loss in 2.17.0
        '--force': Boolean,
        '-f': '--force',
      },
      false,
    )

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    if (args['--preview-feature']) {
      logger.warn(`Prisma "db push" was in Preview and is now Generally Available.
You can now remove the ${chalk.red('--preview-feature')} flag.`)
    }

    if (args['--force']) {
      throw new DbPushForceFlagRenamedError()
    }

    const schemaPath = await getSchemaPath(args['--schema'])

    if (!schemaPath) {
      throw new NoSchemaFoundError()
    }

    console.info(
      chalk.dim(
        `Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    await printDatasource(schemaPath)

    const dbInfo = await getDbInfo(schemaPath)

    const migrate = new Migrate(schemaPath)

    // Automatically create the database if it doesn't exist
    const wasDbCreated = await ensureDatabaseExists('push', true, schemaPath)
    if (wasDbCreated) {
      console.info()
      console.info(wasDbCreated)
    }

    let wasDatabaseReset = false
    if (args['--force-reset']) {
      console.info()
      await migrate.reset()
      if (dbInfo.dbName && dbInfo.dbLocation) {
        console.info(
          `The ${dbInfo.dbType} ${dbInfo.schemaWord} "${dbInfo.dbName}" from "${dbInfo.dbLocation}" was successfully reset.`,
        )
      } else {
        console.info(
          `The ${dbInfo.dbType} ${dbInfo.schemaWord} was successfully reset.`,
        )
      }
      wasDatabaseReset = true
    }

    const before = Date.now()
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
      messages.push(
        `${chalk.bold.red('\n⚠️ We found changes that cannot be executed:\n')}`,
      )
      for (const item of migration.unexecutable) {
        messages.push(`${chalk(`  • ${item}`)}`)
      }
      console.info() // empty line

      // We use prompts.inject() for testing in our CI
      if (isCi() && Boolean((prompt as any)._injected?.length) === false) {
        migrate.stop()
        throw new Error(`${messages.join('\n')}\n
Use the --force-reset flag to drop the database before push like ${chalk.bold.greenBright(
          getCommandWithExecutor('prisma db push --force-reset'),
        )}
${chalk.bold.redBright('All data will be lost.')}
        `)
      } else {
        console.info(`${messages.join('\n')}\n`)
      }

      console.info() // empty line
      const confirmation = await prompt({
        type: 'confirm',
        name: 'value',
        message: `To apply this change we need to reset the database, do you want to continue? ${chalk.red(
          'All data will be lost',
        )}.`,
      })

      if (!confirmation.value) {
        console.info('Reset cancelled.')
        migrate.stop()
        process.exit(0)
        // For snapshot test, because exit() is mocked
        return ``
      }

      await migrate.reset()
      if (dbInfo.dbName && dbInfo.dbLocation) {
        console.info(
          `The ${dbInfo.dbType} ${dbInfo.schemaWord} "${dbInfo.dbName}" from "${dbInfo.dbLocation}" was successfully reset.`,
        )
      } else {
        console.info(
          `The ${dbInfo.dbType} ${dbInfo.schemaWord} was successfully reset.`,
        )
      }
      wasDatabaseReset = true
    }

    if (migration.warnings && migration.warnings.length > 0) {
      console.info(
        chalk.bold.yellow(
          `\n⚠️  There might be data loss when applying the changes:\n`,
        ),
      )

      for (const warning of migration.warnings) {
        console.info(chalk(`  • ${warning}`))
      }
      console.info() // empty line

      if (!args['--accept-data-loss']) {
        // We use prompts.inject() for testing in our CI
        if (isCi() && Boolean((prompt as any)._injected?.length) === false) {
          migrate.stop()
          throw new DbPushIgnoreWarningsWithFlagError()
        }

        console.info() // empty line
        const confirmation = await prompt({
          type: 'confirm',
          name: 'value',
          message: `Do you want to ignore the warning(s)?`,
        })

        if (!confirmation.value) {
          console.info('Push cancelled.')
          migrate.stop()
          process.exit(0)
          // For snapshot test, because exit() is mocked
          return ``
        }

        await migrate.push({
          force: true,
        })
      }
    }

    migrate.stop()

    if (
      !wasDatabaseReset &&
      migration.warnings.length === 0 &&
      migration.executedSteps === 0
    ) {
      console.info(`\nThe database is already in sync with the Prisma schema.`)
    } else {
      console.info(
        `\n${
          process.platform === 'win32' ? '' : '🚀  '
        }Your database is now in sync with your schema. Done in ${formatms(
          Date.now() - before,
        )}`,
      )
    }

    // Run if not skipped
    if (!process.env.PRISMA_MIGRATE_SKIP_GENERATE && !args['--skip-generate']) {
      await migrate.tryToRunGenerate()
    }

    return ``
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${DbPush.help}`)
    }
    return DbPush.help
  }
}
