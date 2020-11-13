import {
  arg,
  Command,
  format,
  getSchemaPath,
  HelpError,
  isError,
  canConnectToDatabase,
  getCommandWithExecutor,
} from '@prisma/sdk'
import chalk from 'chalk'
import prompt from 'prompts'
import path from 'path'
import { ensureCanConnectToDatabase } from '../utils/ensureDatabaseExists'
import { Migrate } from '../Migrate'
import {
  EarlyAcessFlagError,
  ExperimentalFlagWithNewMigrateError,
} from '../utils/flagErrors'
import { printFilesFromMigrationIds } from '../utils/printFiles'
import Debug from '@prisma/debug'

const debug = Debug('resolve')

export class MigrateResolve implements Command {
  public static new(): MigrateResolve {
    return new MigrateResolve()
  }

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

           -h, --help   Display this help message
      --skip-generate   Skip generate
  `)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(
      argv,
      {
        '--help': Boolean,
        '-h': '--help',
        '--skip-generate': Boolean,
        '--experimental': Boolean,
        '--early-access-feature': Boolean,
        '--schema': String,
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

    if (args['--experimental']) {
      throw new ExperimentalFlagWithNewMigrateError()
    }

    if (!args['--early-access-feature']) {
      throw new EarlyAcessFlagError()
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
        `Prisma schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    const migrate = new Migrate(schemaPath)

    await ensureCanConnectToDatabase(schemaPath)

    const diagnoseResult = await migrate.diagnoseMigrationHistory()
    debug({ diagnoseResult })

    if (!diagnoseResult.hasMigrationsTable) {
      debug('Baselining case, !hasMigrationsTable')
      // - This is the **baselining** case.
      // - Look at the migrations in the migrations folder
      //     - There is no local migration
      //         - Error → guide the user to an  (optionally)
      //     - There are local migrations
      //         - Take the first migration (ordered lexicographically) (think about picking multiple later), and ask the user for confirmation that this is the migration they want to use as baseline.
      //         - *To think about for the future: we could validate drift at this point already, with the shadow database.*
      //         - ↩️ **RPC**: ****`markMigrationApplied` with the migration folder name (including timestamp).
      //         - Optional: call ↩️ **RPC**:`diagnoseMigrationHistory` again to confirm that the drift was corrected.

      const listMigrationDirectoriesResult = await migrate.listMigrationDirectories()

      if (listMigrationDirectoriesResult.migrations.length === 0) {
        migrate.stop()
        throw Error(
          'Check init flow with introspect + SQL schema dump (TODO docs)',
        )
      } else {
        const migrationId = listMigrationDirectoriesResult.migrations.shift() as string
        const confirmedBaselineMigration = await this.confirmBaselineMigration({
          migrationId,
        })
        if (confirmedBaselineMigration) {
          await migrate.markMigrationApplied({ migrationId })

          // todo diagnoseMigrationHistory again
          const diagnoseResultAgain = await migrate.diagnoseMigrationHistory()
          debug({ diagnoseResultAgain })

          migrate.stop()
          return `Resolve successful, ${migrationId} is now the the baseline migration for the database.`
        } else {
          migrate.stop()
          this.cancelledByUserExitProcess()
        }
      }
    } else if (diagnoseResult.failedMigrationNames.length > 0) {
      debug(
        `${diagnoseResult.failedMigrationNames.length} failedMigrationNames`,
      )
      // - This is the **recovering from a partially failed migration** case.
      // - Look at `drift.DriftDetected.rollback` .
      if (
        diagnoseResult.drift?.diagnostic === 'driftDetected' &&
        diagnoseResult.drift.rollback
      ) {
        debug(`${diagnoseResult.drift.rollback} rollback?`)
        // If present: display, and offer to apply it, ~~or edit it then apply it~~, or ignore it. (we'll do the edit-then-apply workflow later, maybe)
        //     - If there is a script the user wants to apply, call ↩️ **RPC**: ****`applyScript`.
        //     - Call ↩️ **RPC**:`diagnoseMigrationHistory` again to confirm that the drift was corrected.
        const confirmedApplyScript = await this.confirmApplyScript({
          script: diagnoseResult.drift.rollback,
        })
        if (confirmedApplyScript) {
          await migrate.applyScript({ script: diagnoseResult.drift.rollback })

          // todo diagnoseMigrationHistory again
          const diagnoseResultAgain = await migrate.diagnoseMigrationHistory()
          debug({ diagnoseResultAgain })

          migrate.stop()
          return `Resolve successful - Rollback applied.`
        } else {
          migrate.stop()
          this.cancelledByUserExitProcess()
        }
      } else {
        debug(`${diagnoseResult.failedMigrationNames} mark as fixed?`)
        migrate.stop()
        throw Error('Unhandled else case for "close the case"')
        // - Offer the option to "close the case" and mark the failed migration as fixed.
        //     - The migration can be fixed as rolled back or forward. Ask the user, and call the engine commands in consequence:
        //     - If the migration was rolled back, ↩️ **RPC**: `markMigrationRolledBack`
        //     - If the migration was finished by the user, ↩️ **RPC**: `markMigrationApplied`
      }

      return ``
    } else if (diagnoseResult.drift?.diagnostic === 'driftDetected') {
      debug('driftDetected')
      // - Offer to
      // - *User doesn't want the changes:* offer to roll that drift back (see the flow in point 2.), **or**
      // - *User wants the changes in their local history:* tell the user they can reintrospect and call `prisma migrate` to create a new migration matching the detected changes
      // - *User committed the changes in a migration and applied them outside of prisma migrate:* mark a migration that isn't applied yet as applied (hotfix case).
      //     - Call ↩️ **RPC**: ****`markMigrationApplied`

      const confirmDrift = await migrate.confirmDrift({
        script: diagnoseResult.drift.rollback,
      })
      debug({ confirmDrift })

      if (confirmDrift === 'cancel') {
        migrate.stop()
        this.cancelledByUserExitProcess()
      } else if (confirmDrift === 'rollback') {
        debug(
          '*User doesnt want the changes:* offer to roll that drift back (see the flow in point 2.)',
        )

        await migrate.applyScript({ script: diagnoseResult.drift.rollback })

        const diagnoseResultAfter = await migrate.diagnoseMigrationHistory()
        debug({ diagnoseResultAfter })

        return `Rollback successful.`
      } else if (confirmDrift === 'keep') {
        migrate.stop()
        return `To keep the database change, run ${chalk.bold.greenBright(
          getCommandWithExecutor('prisma introspect --early-access-feature'),
        )} and then ${chalk.bold.greenBright(
          getCommandWithExecutor('prisma migrate --early-access-feature'),
        )} to create a new migration matching the change.`
      } else if (confirmDrift === 'hotfix') {
        if (diagnoseResult.history?.diagnostic === 'databaseIsBehind') {
          await migrate.markMigrationApplied({
            migrationId: diagnoseResult.history.unappliedMigrationsNames[0],
          })
          migrate.stop()
          return `Resolve successful, ${diagnoseResult.history.unappliedMigrationsNames[0]} is now marked as applied for the database.`
        } else {
          migrate.stop()
          throw Error('Unhandled hotfix case for driftDetected')
        }
      }
    } else {
      migrate.stop()
      return `Nothing to resolve.`
    }

    return ``
  }

  private cancelledByUserExitProcess() {
    console.info() // empty line
    console.info('Resolve cancelled.')
    process.exit(0)
  }

  private async confirmBaselineMigration({
    migrationId,
  }: {
    migrationId: string
  }): Promise<boolean> {
    const confirmation = await prompt({
      type: 'confirm',
      name: 'value',
      message: `Do you want to take the migration ${chalk.green(
        migrationId,
      )} as the baseline?`,
    })

    if (!confirmation.value) {
      return false
    }

    return true
  }

  private async confirmApplyScript({
    script,
  }: {
    script: string
  }): Promise<boolean> {
    const confirmation = await prompt({
      type: 'confirm',
      name: 'value',
      message: `Do you want to apply the following? ${chalk.red(
        'Data could be lost',
      )}.\n${chalk.grey(script)}`,
    })

    if (!confirmation.value) {
      return false
    }

    return true
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${MigrateResolve.help}`,
      )
    }
    return MigrateResolve.help
  }
}
