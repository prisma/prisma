import {
  arg,
  Command,
  format,
  getSchemaPath,
  HelpError,
  isError,
} from '@prisma/sdk'
import chalk from 'chalk'
import path from 'path'
import { Migrate } from '../Migrate'
import { ensureDatabaseExists } from '../utils/ensureDatabaseExists'
import { ExperimentalFlagError } from '../utils/experimental'
import { printFilesFromMigrationIds } from '../utils/printFiles'
import {
  handleUnexecutableSteps,
  handleWarnings,
} from '../utils/handleEvaluateDataloss'
import { getMigrationName } from '../utils/promptForMigrationName'

export class MigrateUp implements Command {
  public static new(): MigrateUp {
    return new MigrateUp()
  }

  // static help template
  private static help = format(`
    Migrate your database up to a specific state.

    ${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's migration functionality is currently in an experimental state.",
  )}
    ${chalk.dim(
      'When using any of the commands below you need to explicitly opt-in via the --experimental flag.',
    )}

    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma migrate up --experimental

    ${chalk.bold('Options')}

      -h, --help              Displays this help message
      --dev,  --development   Checks thedatabase state and interactively ask to reset if needed before applying migrations.
      --prod, --production    Applies unapplied migrations only.

  `)

  // parse arguments
  public async parse(argv: string[]): Promise<string | Error> {
    // parse the arguments according to the spec
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--experimental': Boolean,
        '--dev': Boolean,
        '--development': '--dev',
        '--prod': Boolean,
        '--production': '--prod',
        '--force': Boolean,
        '-f': '--force',
        '--schema': String,
        '--telemetry-information': String,
      },
      false,
    )

    if (isError(args)) {
      return this.help(args.message)
    }

    if (
      (!args['--dev'] && !args['--prod']) ||
      (args['--dev'] && args['--prod'])
    ) {
      return this.help(`You must pass either --dev or --prod`)
    }

    if (args['--help']) {
      return this.help()
    }

    if (!args['--experimental']) {
      throw new ExperimentalFlagError()
    }

    const schemaPath = await getSchemaPath(args['--schema'])

    if (!schemaPath) {
      throw new Error(
        `Could not find a ${chalk.bold(
          'schema.prisma',
        )} file that is required for this command.\nYou can either provide it with ${chalk.greenBright(
          '--schema',
        )}, set it as \`prisma.schema\` in your package.json or put it into the default location ${chalk.greenBright(
          './prisma/schema.prisma',
        )} https://pris.ly/d/prisma-schema-location`,
      )
    }

    console.info(
      chalk.dim(
        `Prisma Schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    const migrate = new Migrate(schemaPath)

    await ensureDatabaseExists('apply', true, schemaPath)

    let migrationIds
    if (args['--prod']) {
      migrationIds = await migrate.applyOnly()
    } else {
      await migrate.checkHistoryAndReset({ force: args['--force'] })

      const evaluateDataLossResult = await migrate.evaluateDataLoss()

      // throw error
      handleUnexecutableSteps(evaluateDataLossResult.unexecutableSteps)
      // log warnings and prompt user to continue if needed
      const userCancelled = await handleWarnings(
        evaluateDataLossResult.warnings,
        args['--force'],
      )
      if (userCancelled) {
        migrate.stop()
        return `Migration cancelled.`
      }

      let migrationName: undefined | string = undefined
      if (evaluateDataLossResult.migrationSteps.length > 0) {
        const getMigrationNameResult = await getMigrationName(args['--name'])
        if (getMigrationNameResult.userCancelled) {
          migrate.stop()
          return getMigrationNameResult.userCancelled
        } else {
          migrationName = getMigrationNameResult.name
        }
      }

      migrationIds = await migrate.createAndApply({
        name: migrationName,
      })
    }

    migrate.stop()

    if (migrationIds.length === 0) {
      console.info(
        `\n${chalk.green(
          'Everything is already in sync',
        )} - Prisma Migrate didn't find unapplied migrations.`,
      )
    } else {
      console.info(
        `\nPrisma Migrate applied the following migration(s):\n\n${chalk(
          printFilesFromMigrationIds('migrations', migrationIds, {
            'migration.sql': '',
          }),
        )}`,
      )

      // Run if not skipped
      if (!process.env.MIGRATE_SKIP_GENERATE && !args['--skip-generate']) {
        await migrate.tryToRunGenerate()
      }
    }

    return ``
  }

  // help message
  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${MigrateUp.help}`,
      )
    }
    return MigrateUp.help
  }
}
