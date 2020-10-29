import {
  arg,
  Command,
  format,
  getCommandWithExecutor,
  getSchemaPath,
  HelpError,
  isError,
  isCi,
} from '@prisma/sdk'
import chalk from 'chalk'
import path from 'path'
import prompt from 'prompts'
import { Migrate } from '../Migrate'
import { EarlyAcessFlagError } from '../utils/flagErrors'
import { printFilesFromMigrationIds } from '../utils/printFiles'

export class MigrateReset implements Command {
  public static new(): MigrateReset {
    return new MigrateReset()
  }

  private static help = format(`
    Reset your database and reapply migrations

    ${chalk.bold.yellow('WARNING')} ${chalk.bold(
    "Prisma's migration functionality is currently in Early Access.",
  )}
    ${chalk.dim(
      'When using any of the commands below you need to explicitly opt-in via the --early-access-feature flag.',
    )}

    ${chalk.bold('Usage')}

      ${chalk.dim('$')} prisma migrate reset --early-access-feature

    ${chalk.bold('Options')}

           -h, --help   Display this help message
          -f, --force   Skip the confirmation prompt
      --skip-generate   Skip generate

  `)

  public async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--force': Boolean,
      '-f': '--force',
      '--skip-generate': Boolean,
      '--early-access-feature': Boolean,
      '--schema': String,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
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
        `Prisma Schema loaded from ${path.relative(process.cwd(), schemaPath)}`,
      ),
    )

    if (!args['--force']) {
      if (isCi()) {
        throw Error(
          `Use the --force flag to use the reset command in an unnattended environment like ${chalk.bold.greenBright(
            getCommandWithExecutor(
              'prisma reset --force --early-access-feature',
            ),
          )}`,
        )
      }

      console.info() // empty line
      const confirmation = await prompt({
        type: 'confirm',
        name: 'value',
        message: `Are you sure you want to reset your database? ${chalk.red(
          'All data will be lost',
        )}.`,
      })

      if (!confirmation.value) {
        console.info('Reset cancelled.')
        process.exit(0)
      }
    }

    const migrate = new Migrate(schemaPath)

    await migrate.reset()

    const migrationIds = await migrate.applyOnly()
    migrate.stop()

    if (migrationIds.length === 0) {
      console.info(
        `\n${chalk.green(
          'Database reset successful',
        )} - Prisma Migrate didn't find unapplied migrations.`,
      )
    } else {
      console.info(
        `\n${chalk.green(
          'Database reset successful',
        )} - Prisma Migrate applied the following migration(s):\n\n${chalk(
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

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(
        `\n${chalk.bold.red(`!`)} ${error}\n${MigrateReset.help}`,
      )
    }
    return MigrateReset.help
  }
}
