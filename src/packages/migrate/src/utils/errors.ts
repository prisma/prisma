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
          `prisma migrate ${subcommand} --force --preview-feature`,
        ),
      )}`,
    )
  }
}

export class MigrateResetEnvNonInteractiveError extends Error {
  constructor() {
    super(
      `Prisma Migrate has detected that the environment is non-interactive. It is recommended to run this command in an interactive environment.

Use ${chalk.bold.greenBright(
        `--force`,
      )} to run this command without user interaction.
See ${link(
        'https://www.prisma.io/docs/reference/api-reference/command-reference#migrate-reset',
      )}`,
    )
  }
}

export class MigrateDevEnvNonInteractiveError extends Error {
  constructor() {
    super(
      `Prisma Migrate has detected that the environment is non-interactive, which is not supported.

\`prisma migrate dev\` is an interactive command designed to create new migrations and evolve the database in development.
To apply existing migrations in deployments, use ${chalk.bold.greenBright(
        `prisma migrate deploy`,
      )}.
See ${link(
        'https://www.prisma.io/docs/reference/api-reference/command-reference#migrate-deploy',
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
