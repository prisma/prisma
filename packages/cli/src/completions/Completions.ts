import t from '@bomb.sh/tab'
import type { PrismaConfigInternal } from '@prisma/config'
import { arg, Command, HelpError, isError } from '@prisma/internals'

// NOTE: The provided option-value completions (datasource providers, ports, etc.)
// are examples and may be customized or removed as needed.

export class Completions implements Command {
  public static new(): Completions {
    return new Completions()
  }

  public parse(argv: string[], _config: PrismaConfigInternal): Promise<string | Error> {
    // Check for completion request first (before arg parsing)
    // Format: prisma complete -- <command> <args...>
    if (argv[0] === '--') {
      this.setupCompletions()
      try {
        t.parse(argv.slice(1))
        return Promise.resolve('')
      } catch (e) {
        return Promise.resolve(new Error(`Failed to parse completions: ${e}`))
      }
    }

    const args = arg(argv, {})

    if (isError(args)) {
      return Promise.resolve(new HelpError(args.message))
    }

    const firstArg = args._[0]

    // Setup shell completion scripts
    // Format: prisma complete zsh|bash|fish|powershell
    if (firstArg && ['zsh', 'bash', 'fish', 'powershell'].includes(firstArg)) {
      this.setupCompletions()
      try {
        t.setup('prisma', 'prisma', firstArg)
        return Promise.resolve('')
      } catch (e) {
        return Promise.resolve(new Error(`Failed to setup completions: ${e}`))
      }
    }

    return Promise.resolve(new HelpError('Invalid shell type. Must be one of: zsh, bash, fish, powershell'))
  }

  private setupCompletions() {
    // Root level commands
    const init = t.command('init', 'Set up Prisma for your app')
    const dev = t.command('dev', 'Start a local Prisma Postgres server for development')
    const generate = t.command('generate', 'Generate artifacts (e.g. Prisma Client)')
    t.command('db', 'Manage your database schema and lifecycle')
    t.command('migrate', 'Migrate your database')
    const studio = t.command('studio', 'Browse your data with Prisma Studio')
    const validate = t.command('validate', 'Validate your Prisma schema')
    const format = t.command('format', 'Format your Prisma schema')
    const version = t.command('version', 'Displays Prisma version info')
    t.command('debug', 'Displays Prisma debug info')
    const mcp = t.command('mcp', 'Starts an MCP server to use with AI development tools')
    t.command('platform', 'Manage Prisma Platform resources')

    // db subcommands (space-separated)
    const dbExecute = t.command('db execute', 'Execute SQL or scripts on your database')
    const dbPull = t.command('db pull', 'Pull the schema from an existing database')
    const dbPush = t.command('db push', 'Push the Prisma schema state to the database')
    const dbSeed = t.command('db seed', 'Seed your database')

    // migrate subcommands (space-separated)
    const migrateDev = t.command('migrate dev', 'Create and apply migrations in development')
    const migrateReset = t.command('migrate reset', 'Reset your database and apply all migrations')
    const migrateDeploy = t.command('migrate deploy', 'Apply pending migrations to the database')
    const migrateStatus = t.command('migrate status', 'Check the status of your database migrations')
    const migrateResolve = t.command('migrate resolve', 'Mark a migration as applied or rolled back')
    const migrateDiff = t.command('migrate diff', 'Compare the database schema from two arbitrary sources')

    // platform subcommands (space-separated)
    t.command('platform auth', 'Manage authentication')
    t.command('platform workspace', 'Manage workspaces')
    t.command('platform environment', 'Manage environments')
    t.command('platform project', 'Manage projects')
    t.command('platform pulse', 'Manage Prisma Pulse')
    t.command('platform accelerate', 'Manage Prisma Accelerate')

    // platform auth subcommands
    t.command('platform auth login', 'Log in to Prisma Platform')
    t.command('platform auth logout', 'Log out from Prisma Platform')
    t.command('platform auth show', 'Show current authentication status')

    // platform workspace subcommands
    t.command('platform workspace show', 'Show workspace information')

    // platform environment subcommands
    t.command('platform environment create', 'Create a new environment')
    t.command('platform environment delete', 'Delete an environment')
    t.command('platform environment show', 'Show environment information')

    // platform project subcommands
    t.command('platform project create', 'Create a new project')
    t.command('platform project delete', 'Delete a project')
    t.command('platform project show', 'Show project information')

    // platform pulse subcommands
    t.command('platform pulse enable', 'Enable Prisma Pulse')
    t.command('platform pulse disable', 'Disable Prisma Pulse')

    // platform accelerate subcommands
    t.command('platform accelerate enable', 'Enable Prisma Accelerate')
    t.command('platform accelerate disable', 'Disable Prisma Accelerate')

    // init options
    init.option('url', 'Define a custom datasource url', (complete) => {
      complete('postgresql://', 'PostgreSQL connection string')
      complete('mysql://', 'MySQL connection string')
      complete('sqlite:', 'SQLite connection string')
      complete('mongodb://', 'MongoDB connection string')
      complete('sqlserver://', 'SQL Server connection string')
    })
    init.option('datasource-provider', 'Define the datasource provider', (complete) => {
      complete('postgresql', 'PostgreSQL')
      complete('mysql', 'MySQL')
      complete('sqlite', 'SQLite')
      complete('mongodb', 'MongoDB')
      complete('sqlserver', 'SQL Server')
      complete('cockroachdb', 'CockroachDB')
    })
    init.option('generator-provider', 'Define the generator provider', (complete) => {
      complete('prisma-client', '')
      complete('prisma-client-js', '')
    })

    // dev options (for Prisma Postgres local database)
    dev.option('name', 'Target a specific database instance', (complete) => {
      complete('my-db', 'Example database name')
    })
    dev.option('n', 'Short for --name')
    dev.option('port', 'Main port number for the HTTP server', (complete) => {
      complete('51213', 'Default HTTP server port')
    })
    dev.option('p', 'Short for --port')
    dev.option('db-port', 'Port number for the database server', (complete) => {
      complete('51214', 'Default database port')
    })
    dev.option('P', 'Short for --db-port')
    dev.option('shadow-db-port', 'Port number for the shadow database server', (complete) => {
      complete('51215', 'Default shadow database port')
    })
    dev.option('debug', 'Enable debug mode')

    // generate options
    generate.option('schema', 'Custom path to your Prisma schema')
    generate.option('config', 'Custom path to your Prisma config file')
    generate.option('watch', 'Watch the Prisma schema and rerun after a change')
    generate.option('generator', 'Generator to use (may be provided multiple times)')
    generate.option('no-engine', 'Generate a client for use with Accelerate only')
    generate.option('no-hints', 'Hides the hint messages but still outputs errors and warnings')
    generate.option('allow-no-models', 'Allow generating a client without models')
    generate.option('require-models', 'Do not allow generating a client without models')
    generate.option('sql', 'Generate typed sql module')

    // studio options
    studio.option('schema', 'Custom path to your Prisma schema')
    studio.option('config', 'Custom path to your Prisma config file')
    studio.option('port', 'Port to start Studio on', (complete) => {
      complete('5555', 'Default Studio port')
      complete('3000', 'Alternative port')
    })
    studio.option('browser', 'Browser to auto-open Studio in', (complete) => {
      complete('none', 'Do not open browser')
      complete('chrome', 'Google Chrome')
      complete('firefox', 'Mozilla Firefox')
      complete('safari', 'Safari')
    })
    studio.option('hostname', 'Hostname to bind the Express server to')

    // validate options
    validate.option('schema', 'Custom path to your Prisma schema')
    validate.option('config', 'Custom path to your Prisma config file')

    // format options
    format.option('schema', 'Custom path to your Prisma schema')
    format.option('config', 'Custom path to your Prisma config file')
    format.option('check', 'Check if the schema is formatted')

    // version options
    version.option('json', 'Output version information as JSON')

    // mcp options
    mcp.option('schema', 'Custom path to your Prisma schema')
    mcp.option('config', 'Custom path to your Prisma config file')

    // db subcommand options
    dbExecute.option('schema', 'Custom path to your Prisma schema')
    dbExecute.option('config', 'Custom path to your Prisma config file')
    dbExecute.option('file', 'Path to a file with SQL or script')
    dbExecute.option('stdin', 'Read SQL or script from stdin')

    dbPull.option('schema', 'Custom path to your Prisma schema')
    dbPull.option('config', 'Custom path to your Prisma config file')
    dbPull.option('force', 'Ignore current Prisma schema and overwrite')
    dbPull.option('print', 'Print the introspected Prisma schema to stdout')
    dbPull.option('composite-type-depth', 'Specify the depth for introspecting composite types')

    dbPush.option('schema', 'Custom path to your Prisma schema')
    dbPush.option('config', 'Custom path to your Prisma config file')
    dbPush.option('accept-data-loss', 'Ignore data loss warnings')
    dbPush.option('force-reset', 'Force a reset of the database before push')
    dbPush.option('skip-generate', 'Skip triggering generators after push')

    dbSeed.option('schema', 'Custom path to your Prisma schema')
    dbSeed.option('config', 'Custom path to your Prisma config file')

    // migrate subcommand options
    migrateDev.option('schema', 'Custom path to your Prisma schema')
    migrateDev.option('config', 'Custom path to your Prisma config file')
    migrateDev.option('name', 'Name of the migration')
    migrateDev.option('create-only', 'Create a new migration but do not apply it')
    migrateDev.option('skip-seed', 'Skip triggering seed')
    migrateDev.option('skip-generate', 'Skip triggering generators')

    migrateReset.option('schema', 'Custom path to your Prisma schema')
    migrateReset.option('config', 'Custom path to your Prisma config file')
    migrateReset.option('force', 'Skip the confirmation prompt')
    migrateReset.option('skip-seed', 'Skip triggering seed')
    migrateReset.option('skip-generate', 'Skip triggering generators')

    migrateDeploy.option('schema', 'Custom path to your Prisma schema')
    migrateDeploy.option('config', 'Custom path to your Prisma config file')

    migrateStatus.option('schema', 'Custom path to your Prisma schema')
    migrateStatus.option('config', 'Custom path to your Prisma config file')

    migrateResolve.option('schema', 'Custom path to your Prisma schema')
    migrateResolve.option('config', 'Custom path to your Prisma config file')
    migrateResolve.option('applied', 'Mark a migration as applied')
    migrateResolve.option('rolled-back', 'Mark a migration as rolled back')

    migrateDiff.option('schema', 'Custom path to your Prisma schema')
    migrateDiff.option('config', 'Custom path to your Prisma config file')
    migrateDiff.option('from-url', 'URL of the source database')
    migrateDiff.option('to-url', 'URL of the target database')
    migrateDiff.option('from-schema-datamodel', 'Path to a Prisma schema file for the source')
    migrateDiff.option('to-schema-datamodel', 'Path to a Prisma schema file for the target')
    migrateDiff.option('from-schema-datasource', 'URL to the source database')
    migrateDiff.option('to-schema-datasource', 'URL to the target database')
    migrateDiff.option('from-migrations', 'Path to migrations directory for source')
    migrateDiff.option('to-migrations', 'Path to migrations directory for target')
    migrateDiff.option('from-empty', 'Assume the source schema is empty')
    migrateDiff.option('to-empty', 'Assume the target schema is empty')
    migrateDiff.option('script', 'Output a SQL script')
    migrateDiff.option('exit-code', 'Change the exit code behavior')
  }
}
