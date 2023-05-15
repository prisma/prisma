import { getCommandWithExecutor, link, setClassName } from '@prisma/internals'
import { bold, green } from 'kleur/colors'

export class NoSchemaFoundError extends Error {
  constructor() {
    super(
      `Could not find a ${bold(
        'schema.prisma',
      )} file that is required for this command.\nYou can either provide it with ${green(
        '--schema',
      )}, set it as \`prisma.schema\` in your package.json or put it into the default location ${green(
        './prisma/schema.prisma',
      )} ${link('https://pris.ly/d/prisma-schema-location')}`,
    )
  }
}
setClassName(NoSchemaFoundError, 'NoSchemaFoundError')
export class OldMigrateDetectedError extends Error {
  constructor() {
    super(
      `The migrations folder contains migration files from an older version of Prisma Migrate which is not compatible.

Read more about how to upgrade to the new version of Migrate:
${link('https://pris.ly/d/migrate-upgrade')}`,
    )
  }
}
setClassName(OldMigrateDetectedError, 'OldMigrateDetectedError')

export class DbPushForceFlagRenamedError extends Error {
  constructor() {
    super(
      `The --force flag was renamed to --accept-data-loss in 2.17.0, use ${bold(
        green(getCommandWithExecutor('prisma db push --accept-data-loss')),
      )}`,
    )
  }
}
setClassName(DbPushForceFlagRenamedError, 'DbPushForceFlagRenamedError')

export class DbPushIgnoreWarningsWithFlagError extends Error {
  constructor() {
    super(
      `Use the --accept-data-loss flag to ignore the data loss warnings like ${bold(
        green(getCommandWithExecutor('prisma db push --accept-data-loss')),
      )}`,
    )
  }
}
setClassName(DbPushIgnoreWarningsWithFlagError, 'DbPushIgnoreWarningsWithFlagError')

export class MigrateNeedsForceError extends Error {
  constructor(subcommand: string) {
    super(
      `Use the --force flag to use the ${subcommand} command in an unattended environment like ${bold(
        green(getCommandWithExecutor(`prisma migrate ${subcommand} --force`)),
      )}`,
    )
  }
}
setClassName(MigrateNeedsForceError, 'MigrateNeedsForceError')

export class MigrateResetEnvNonInteractiveError extends Error {
  constructor() {
    super(
      `Prisma Migrate has detected that the environment is non-interactive. It is recommended to run this command in an interactive environment.

Use ${bold(green(`--force`))} to run this command without user interaction.
See ${link('https://www.prisma.io/docs/reference/api-reference/command-reference#migrate-reset')}`,
    )
  }
}
setClassName(MigrateResetEnvNonInteractiveError, 'MigrateResetEnvNonInteractiveError')

export class MigrateDevEnvNonInteractiveError extends Error {
  constructor() {
    super(
      `Prisma Migrate has detected that the environment is non-interactive, which is not supported.

\`prisma migrate dev\` is an interactive command designed to create new migrations and evolve the database in development.
To apply existing migrations in deployments, use ${bold(green(`prisma migrate deploy`))}.
See ${link('https://www.prisma.io/docs/reference/api-reference/command-reference#migrate-deploy')}`,
    )
  }
}
setClassName(MigrateDevEnvNonInteractiveError, 'MigrateDevEnvNonInteractiveError')

export class DbNeedsForceError extends Error {
  constructor(subcommand: string) {
    super(
      `Use the --force flag to use the ${subcommand} command in an unattended environment like ${bold(
        green(getCommandWithExecutor(`prisma db ${subcommand} --force --preview-feature`)),
      )}`,
    )
  }
}
setClassName(DbNeedsForceError, 'DbNeedsForceError')
