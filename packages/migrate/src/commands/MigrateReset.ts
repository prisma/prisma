import type { PrismaConfigInternal } from '@prisma/config'
import {
  arg,
  canPrompt,
  checkUnsupportedDataProxy,
  Command,
  format,
  HelpError,
  inferDirectoryConfig,
  isError,
  loadEnvFile,
  loadSchemaContext,
} from '@prisma/internals'
import { bold, dim, green, red } from 'kleur/colors'
import prompt from 'prompts'

import { Migrate } from '../Migrate'
import { ensureDatabaseExists, parseDatasourceInfo } from '../utils/ensureDatabaseExists'
import { MigrateResetEnvNonInteractiveError } from '../utils/errors'
import { printDatasource } from '../utils/printDatasource'
import { printFilesFromMigrationIds } from '../utils/printFiles'
import { executeSeedCommand, getSeedCommandFromPackageJson } from '../utils/seed'

export class MigrateReset implements Command {
  public static new(): MigrateReset {
    return new MigrateReset()
  }

  private static help = format(`
Reset your database and apply all migrations, all data will be lost

${bold('Usage')}

  ${dim('$')} prisma migrate reset [options]

${bold('Options')}

       -h, --help   Display this help message
         --config   Custom path to your Prisma config file
         --schema   Custom path to your Prisma schema
  --skip-generate   Skip triggering generators (e.g. Prisma Client)
      --skip-seed   Skip triggering seed
      -f, --force   Skip the confirmation prompt

${bold('Examples')}

  Reset your database and apply all migrations, all data will be lost
  ${dim('$')} prisma migrate reset

  Specify a schema
  ${dim('$')} prisma migrate reset --schema=./schema.prisma 

  Use --force to skip the confirmation prompt
  ${dim('$')} prisma migrate reset --force
  `)

  public async parse(argv: string[], config: PrismaConfigInternal): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--force': Boolean,
      '-f': '--force',
      '--skip-generate': Boolean,
      '--skip-seed': Boolean,
      '--schema': String,
      '--config': String,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    await loadEnvFile({ schemaPath: args['--schema'], printMessage: true, config })

    const schemaContext = await loadSchemaContext({
      schemaPathFromArg: args['--schema'],
      schemaPathFromConfig: config.schema,
    })
    const { migrationsDirPath } = inferDirectoryConfig(schemaContext, config)
    const datasourceInfo = parseDatasourceInfo(schemaContext.primaryDatasource)
    const adapter = await config.adapter?.()

    printDatasource({ datasourceInfo, adapter })

    checkUnsupportedDataProxy({ cmd: 'migrate reset', schemaContext })

    // `ensureDatabaseExists` is not compatible with WebAssembly.
    // TODO: check why the output and error handling here is different than in `MigrateDeploy`.
    if (!adapter) {
      // Automatically create the database if it doesn't exist
      const wasDbCreated = await ensureDatabaseExists(schemaContext.primaryDatasource)
      if (wasDbCreated) {
        process.stdout.write('\n' + wasDbCreated + '\n')
      }
    }

    process.stdout.write('\n')
    if (!args['--force']) {
      if (!canPrompt()) {
        throw new MigrateResetEnvNonInteractiveError()
      }

      const confirmation = await prompt({
        type: 'confirm',
        name: 'value',
        message: `Are you sure you want to reset your database? ${red('All data will be lost')}.`,
      })

      process.stdout.write('\n') // empty line

      if (!confirmation.value) {
        process.stdout.write('Reset cancelled.\n')
        // Return SIGINT exit code to signal that the process was cancelled
        process.exit(130)
      }
    }

    const migrate = await Migrate.setup({ adapter, migrationsDirPath, schemaContext })

    let migrationIds: string[]
    try {
      await migrate.reset()

      const { appliedMigrationNames } = await migrate.applyMigrations()
      migrationIds = appliedMigrationNames
    } finally {
      // Stop engine
      await migrate.stop()
    }

    if (migrationIds.length === 0) {
      process.stdout.write(`${green('Database reset successful\n')}\n`)
    } else {
      process.stdout.write('\n') // empty line
      process.stdout.write(
        `${green('Database reset successful')}

The following migration(s) have been applied:\n\n${printFilesFromMigrationIds('migrations', migrationIds, {
          'migration.sql': '',
        })}\n`,
      )
    }

    // Run if not skipped
    if (!process.env.PRISMA_MIGRATE_SKIP_GENERATE && !args['--skip-generate']) {
      await migrate.tryToRunGenerate(datasourceInfo)
    }

    // Run if not skipped
    if (!process.env.PRISMA_MIGRATE_SKIP_SEED && !args['--skip-seed']) {
      const seedCommandFromPkgJson = await getSeedCommandFromPackageJson(process.cwd())

      if (seedCommandFromPkgJson) {
        process.stdout.write('\n') // empty line
        const successfulSeeding = await executeSeedCommand({ commandFromConfig: seedCommandFromPkgJson })
        if (successfulSeeding) {
          process.stdout.write(`\n${process.platform === 'win32' ? '' : '🌱  '}The seed command has been executed.\n`)
        } else {
          process.exit(1)
        }
      }
    }

    return ``
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${MigrateReset.help}`)
    }
    return MigrateReset.help
  }
}
