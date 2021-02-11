import chalk from 'chalk'
import { getCommandWithExecutor, link } from '@prisma/sdk'

export class NoSchemaFoundError extends Error {
  constructor() {
    super(
      `Could not find a ${chalk.bold(
        'schema.prisma',
      )} file that is required for this command.\nYou can either provide it with ${chalk.greenBright(
        '--schema',
      )}, set it as \`prisma.schema\` in your package.json or put it into the default location ${chalk.greenBright(
        './prisma/schema.prisma',
      )} ${link('https://pris.ly/d/prisma-schema-location')}`,
    )
  }
}
export class OldMigrateDetectedError extends Error {
  constructor() {
    super(
      `The migrations folder contains migration files from an older version of Prisma Migrate which is not compatible.

Read more about how to upgrade to the new version of Migrate:
${link('https://pris.ly/d/migrate-upgrade')}`,
    )
  }
}

export class HowToBaselineError extends Error {
  constructor() {
    super(
      `Read more about how to baseline an existing production database:
${link('https://pris.ly/d/migrate-baseline')}`,
    )
  }
}

export class DbPushForceFlagRenamedError extends Error {
  constructor() {
    super(
      `The --force flag was renamed to --accept-data-loss in 2.17.0, use ${chalk.bold.greenBright(
        getCommandWithExecutor(
          'prisma db push --preview-feature --accept-data-loss',
        ),
      )}`,
    )
  }
}

export class DbPushIgnoreWarningsWithFlagError extends Error {
  constructor() {
    super(
      `Use the --accept-data-loss flag to ignore the data loss warnings like ${chalk.bold.greenBright(
        getCommandWithExecutor(
          'prisma db push --preview-feature --accept-data-loss',
        ),
      )}`,
    )
  }
}

export class MigrateNeedsForceError extends Error {
  constructor(subcommand: string) {
    super(
      `Use the --force flag to use the ${subcommand} command in an unnattended environment like ${chalk.bold.greenBright(
        getCommandWithExecutor(
          `prisma migrate ${subcommand} --force --preview-feature`,
        ),
      )}`,
    )
  }
}

export class EnvNonInteractiveError extends Error {
  constructor() {
    super(
      `We detected that your environment is non-interactive. Running this command in not supported in this context.`,
    )
  }
}

export class DbNeedsForceError extends Error {
  constructor(subcommand: string) {
    super(
      `Use the --force flag to use the ${subcommand} command in an unnattended environment like ${chalk.bold.greenBright(
        getCommandWithExecutor(
          `prisma db ${subcommand} --force --preview-feature`,
        ),
      )}`,
    )
  }
}
