#!/usr/bin/env tsx

import { InjectFormatters } from '@prisma/config'
import Debug from '@prisma/debug'
import { enginesVersion } from '@prisma/engines'
import { download } from '@prisma/fetch-engine'
import { arg, handlePanic, HelpError, isRustPanic, link } from '@prisma/internals'
import {
  DbCommand,
  DbExecute,
  DbPull,
  DbPush,
  // DbDrop,
  DbSeed,
  getDatabaseVersionSafe,
  MigrateCommand,
  MigrateDeploy,
  MigrateDev,
  MigrateDiff,
  MigrateReset,
  MigrateResolve,
  MigrateStatus,
} from '@prisma/migrate'
import { bold, dim, red, yellow } from 'kleur/colors'
import path from 'path'

import { CLI } from './CLI'
import { DebugInfo } from './DebugInfo'
import { Format } from './Format'
import { Generate } from './Generate'
import { Mcp } from './MCP'
import { Platform } from './platform/_Platform'
/*
  When running bin.ts with ts-node with DEBUG="*"
  This error shows and blocks the execution
  Quick hack is to comment the Studio import and usage to use the CLI without building it...
  prisma:cli Error: Cannot find module '@prisma/internals'
  prisma:cli Require stack:
  prisma:cli - /Users/j42/Dev/prisma-meow/node_modules/.pnpm/@prisma+studio-pcw@0.456.0/node_modules/@prisma/studio-pcw/dist/index.js
*/
import { Studio } from './Studio'
import { SubCommand } from './SubCommand'
import { Telemetry } from './Telemetry'
import { redactCommandArray } from './utils/checkpoint'
import { loadOrInitializeCommandState } from './utils/commandState'
import { detectPrisma1 } from './utils/detectPrisma1'
import { loadConfig } from './utils/loadConfig'
import { Validate } from './Validate'
import { Version } from './Version'

const debug = Debug('prisma:cli:bin')

const packageJson = require('../package.json')

const commandArray = process.argv.slice(2)

process.removeAllListeners('warning')

process.once('SIGINT', () => {
  process.exitCode = 130

  // no further downstream listeners for SIGINT, exit immediately with the code set above.
  if (process.listenerCount('SIGINT') === 0) {
    process.exit()
  }
  // otherwise, let the downstream listeners handle it.
})

// Parse CLI arguments
const args = arg(
  commandArray,
  {
    '--config': String,
  },
  false,
  true,
)

/**
 * Main function
 */
async function main(): Promise<number> {
  // create a new CLI with our subcommands

  detectPrisma1()

  const cli = CLI.new(
    {
      init: new SubCommand('@prisma/cli-init'),
      platform: Platform.$.new({
        workspace: Platform.Workspace.$.new({
          show: Platform.Workspace.Show.new(),
        }),
        auth: Platform.Auth.$.new({
          login: Platform.Auth.Login.new(),
          logout: Platform.Auth.Logout.new(),
          show: Platform.Auth.Show.new(),
        }),
        environment: Platform.Environment.$.new({
          create: Platform.Environment.Create.new(),
          delete: Platform.Environment.Delete.new(),
          show: Platform.Environment.Show.new(),
        }),
        project: Platform.Project.$.new({
          create: Platform.Project.Create.new(),
          delete: Platform.Project.Delete.new(),
          show: Platform.Project.Show.new(),
        }),
        pulse: Platform.Pulse.$.new({
          enable: Platform.Pulse.Enable.new(),
          disable: Platform.Pulse.Disable.new(),
        }),
        accelerate: Platform.Accelerate.$.new({
          enable: Platform.Accelerate.Enable.new(),
          disable: Platform.Accelerate.Disable.new(),
        }),
        serviceToken: Platform.ServiceToken.$.new({
          create: Platform.ServiceToken.Create.new(),
          delete: Platform.ServiceToken.Delete.new(),
          show: Platform.ServiceToken.Show.new(),
        }),
        // Alias to "serviceToken". This will be removed in a future ORM release.
        apikey: Platform.ServiceToken.$.new({
          create: Platform.ServiceToken.Create.new(true),
          delete: Platform.ServiceToken.Delete.new(true),
          show: Platform.ServiceToken.Show.new(true),
        }),
      }),
      mcp: Mcp.new(),
      migrate: MigrateCommand.new({
        dev: MigrateDev.new(),
        status: MigrateStatus.new(),
        resolve: MigrateResolve.new(),
        reset: MigrateReset.new(),
        deploy: MigrateDeploy.new(),
        diff: MigrateDiff.new(),
      }),
      db: DbCommand.new({
        execute: DbExecute.new(),
        pull: DbPull.new(),
        push: DbPush.new(),
        // drop: DbDrop.new(),
        seed: DbSeed.new(),
      }),
      /**
       * @deprecated since version 2.30.0, use `db pull` instead (renamed)
       */
      introspect: DbPull.new(),
      studio: Studio.new(),
      generate: Generate.new(),
      version: Version.new(),
      validate: Validate.new(),
      format: Format.new(),
      telemetry: Telemetry.new(),
      debug: DebugInfo.new(),
      // TODO: add rules subcommand to --help after EA
      rules: new SubCommand('@prisma/cli-security-rules'),
      dev: new SubCommand('@prisma/cli-dev'),
      // TODO: add deploy subcommand to --help after it works.
      deploy: new SubCommand('@prisma/cli-deploy'),
      // TODO: add login subcommand to --help after it works.
      login: new SubCommand('@prisma/cli-login'),
    },
    ['version', 'init', 'migrate', 'db', 'introspect', 'studio', 'generate', 'validate', 'format', 'telemetry'],
    download,
  )

  await loadOrInitializeCommandState().catch((err) => {
    debug(`Failed to initialize the command state: ${err}`)
  })

  const configEither = await loadConfig(args['--config'])

  if (configEither instanceof HelpError) {
    console.error(configEither.message)
    return 1
  }

  const { config, diagnostics: configDiagnostics } = configEither

  // Diagnostics like informational logs and warnings are logged to stderr, to not interfere with structured output
  // in some of the commands consuming the Prisma config.
  // See: https://www.gnu.org/software/libc/manual/html_node/Standard-Streams.html
  const configDiagnosticFormatters: InjectFormatters = {
    // This fixes https://github.com/prisma/prisma/issues/27609.
    log: (data) => process.stderr.write(data + '\n'),
    warn: (data) => console.warn(`${yellow(bold('warn'))} ${data}`),
    dim: (data) => dim(data),

    // `terminal-link` is not easily installable in `@prisma/config` without introducing ESM/CJS incompatibility issues, or
    //  circular dependencies (requiring yet another `@prisma` package),
    link: (data) => link(data),
  }

  for (const configDiagnostic of configDiagnostics) {
    configDiagnostic.value(configDiagnosticFormatters)()
  }

  const startCliExec = performance.now()
  // Execute the command
  const result = await cli.parse(commandArray, config)
  const endCliExec = performance.now()
  const cliExecElapsedTime = endCliExec - startCliExec
  debug(`Execution time for executing "await cli.parse(commandArray)": ${cliExecElapsedTime} ms`)

  if (result instanceof Error) {
    console.error(result instanceof HelpError ? result.message : result)
    return 1
  }

  // Success
  console.log(result)

  return 0
}

/**
 * Run our program
 */
if (eval('require.main === module')) {
  main()
    .then((code) => {
      if (code !== 0) {
        process.exit(code)
      }
    })
    .catch((err) => {
      // Sindre's pkg p-map & co are using AggregateError, it is an iterator.
      if (typeof err[Symbol.iterator] === 'function') {
        for (const individualError of err) {
          handleIndividualError(individualError)
        }
      } else {
        handleIndividualError(err)
      }
    })
}

function handleIndividualError(error: Error): void {
  if (isRustPanic(error)) {
    handlePanic({
      error,
      cliVersion: packageJson.version,
      enginesVersion,
      command: redactCommandArray([...commandArray]).join(' '),
      getDatabaseVersionSafe,
    })
      .catch((e) => {
        if (Debug.enabled('prisma')) {
          console.error(bold(red('Error: ')) + e.stack)
        } else {
          console.error(bold(red('Error: ')) + e.message)
        }
      })
      .finally(() => {
        process.exit(1)
      })
  } else {
    if (Debug.enabled('prisma')) {
      console.error(bold(red('Error: ')) + error.stack)
    } else {
      console.error(bold(red('Error: ')) + error.message)
    }
    process.exit(1)
  }
}

/**
 * Annotations for `pkg` so it bundles things correctly with yarn's hoisting
 * `node_modules/prisma/build/index.js` needs to get to:
 * `node_modules/@prisma/engines`
 */

// macOS
path.join(__dirname, '../../engines/query-engine-darwin')
path.join(__dirname, '../../engines/schema-engine-darwin')
// Windows
path.join(__dirname, '../../engines/query-engine-windows.exe')
path.join(__dirname, '../../engines/schema-engine-windows.exe')

// Debian openssl-1.0.x
path.join(__dirname, '../../engines/query-engine-debian-openssl-1.0.x')
path.join(__dirname, '../../engines/schema-engine-debian-openssl-1.0.x')
// Debian openssl-1.1.x
path.join(__dirname, '../../engines/query-engine-debian-openssl-1.1.x')
path.join(__dirname, '../../engines/schema-engine-debian-openssl-1.1.x')
// Debian openssl-3.0.x
path.join(__dirname, '../../engines/query-engine-debian-openssl-3.0.x')
path.join(__dirname, '../../engines/schema-engine-debian-openssl-3.0.x')

// Red Hat Enterprise Linux openssl-1.0.x
path.join(__dirname, '../../engines/query-engine-rhel-openssl-1.0.x')
path.join(__dirname, '../../engines/schema-engine-rhel-openssl-1.0.x')
// Red Hat Enterprise Linux openssl-1.1.x
path.join(__dirname, '../../engines/query-engine-rhel-openssl-1.1.x')
path.join(__dirname, '../../engines/schema-engine-rhel-openssl-1.1.x')
// Red Hat Enterprise Linux openssl-3.0.x
path.join(__dirname, '../../engines/query-engine-rhel-openssl-3.0.x')
path.join(__dirname, '../../engines/schema-engine-rhel-openssl-3.0.x')
