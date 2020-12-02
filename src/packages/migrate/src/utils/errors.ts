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

export class DbPushWithOldMigrateError extends Error {
  constructor() {
    super(`Using db push alongside migrate will interfere with migrations.
    The SQL in the README.md file of new migrations will not reflect the actual schema changes executed when running "prisma migrate deploy".
    Use the --ignore-migrations flag to ignore this message in an unnattended environment like ${chalk.bold.greenBright(
      getCommandWithExecutor(
        'prisma db push --preview-feature --ignore-migrations',
      ),
    )}`)
  }
}

export class DbPushIgnoreWarningsWithForceError extends Error {
  constructor() {
    super(
      `Use the --force flag to ignore these warnings like ${chalk.bold.greenBright(
        getCommandWithExecutor('prisma db push --preview-feature --force'),
      )}`,
    )
  }
}

export class MigrateNeedsForceError extends Error {
  constructor(subcommand: string) {
    super(
      `Use the --force flag to use the ${subcommand} command in an unnattended environment like ${chalk.bold.greenBright(
        getCommandWithExecutor(
          `prisma migrate ${subcommand} --force --early-access-feature`,
        ),
      )}`,
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
