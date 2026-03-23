import { confirm } from '@inquirer/prompts'
import type { PrismaConfigInternal } from '@prisma/config'
import { loadConfigFromFile } from '@prisma/config'
import type { Command } from '@prisma/internals'
import { arg, format, HelpError, isError } from '@prisma/internals'
import { DbSeed, MigrateDev } from '@prisma/migrate'
import * as checkpoint from 'checkpoint-client'
import { bold, dim, green, red, yellow } from 'kleur/colors'

import { Init } from '../Init'
import { Link, type LinkResult } from '../link/Link'
import { LinkApiError, sanitizeErrorMessage } from '../link/management-api'
import { formatBootstrapOutput, type BootstrapStepStatus } from './completion-output'
import { detectProjectState } from './project-state'
import { emitFlowCompleted, emitFlowStarted, emitStepCompleted, emitStepFailed, emitStepSkipped } from './telemetry'

export class Bootstrap implements Command {
  public static new(): Bootstrap {
    return new Bootstrap()
  }

  private static help = format(`
Bootstrap a Prisma Postgres project from scratch or connect an existing one.

${bold('Usage')}

  ${dim('$')} prisma bootstrap [options]

${bold('Options')}

  --api-key      Workspace API key (CI / non-interactive)
  --database     Database ID to link to (e.g. db_abc123)
  --force        Re-link even if already linked to Prisma Postgres
  -h, --help     Display this help message

${bold('Examples')}

  Interactive (opens browser, guides you through setup)
  ${dim('$')} prisma bootstrap

  Non-interactive with explicit credentials
  ${dim('$')} prisma bootstrap --api-key "<your-api-key>" --database "db_..."
`)

  public async parse(argv: string[], config: PrismaConfigInternal, baseDir: string): Promise<string | Error> {
    const args = arg(argv, {
      '--api-key': String,
      '--database': String,
      '--force': Boolean,
      '--help': Boolean,
      '-h': '--help',
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    const apiKey = args['--api-key']
    const databaseId = args['--database']
    const force = args['--force'] ?? false

    if (apiKey && !databaseId) {
      return new HelpError(
        `\n${bold(red('!'))} Missing ${bold('--database')} flag.\n\nWhen using ${bold('--api-key')}, you must also provide ${bold('--database')}.\n${Bootstrap.help}`,
      )
    }

    if (databaseId && !databaseId.startsWith('db_')) {
      return new HelpError(
        `\n${bold(red('!'))} Invalid database ID "${databaseId}" — expected format: ${bold('db_<id>')}\n${Bootstrap.help}`,
      )
    }

    try {
      return await this.run(apiKey, databaseId, force, config, baseDir)
    } catch (err) {
      if (err instanceof LinkApiError) {
        return new HelpError(`\n${bold(red('!'))} ${sanitizeErrorMessage(err.message)}`)
      }
      const message = err instanceof Error ? err.message : String(err)
      return new HelpError(`\n${bold(red('!'))} ${sanitizeErrorMessage(message)}`)
    }
  }

  private async run(
    apiKey: string | undefined,
    databaseId: string | undefined,
    force: boolean,
    config: PrismaConfigInternal,
    baseDir: string,
  ): Promise<string> {
    const flowStart = performance.now()
    const stepsCompleted: string[] = []
    const steps: BootstrapStepStatus = {
      init: 'skipped',
      link: 'failed',
      migrate: 'not-applicable',
      seed: 'not-applicable',
    }

    let distinctId: string
    try {
      distinctId = await checkpoint.getSignature()
    } catch {
      distinctId = 'unknown'
    }

    const initialState = detectProjectState(baseDir)

    const telemetryCtx = {
      distinctId,
      databaseId,
      linkResult: null as LinkResult | null,
      projectState: initialState,
    }

    await emitFlowStarted(telemetryCtx)

    // --- Step 1: Init (if needed) ---
    if (!initialState.hasSchemaFile) {
      console.log(`\n${bold('Setting up Prisma...')}`)
      const stepStart = performance.now()

      try {
        const init = Init.new()
        const initResult = await init.parse(['--datasource-provider', 'postgresql'], config)

        if (initResult instanceof Error) {
          await emitStepFailed(telemetryCtx, 'init', sanitizeErrorMessage(initResult.message))
          throw new LinkApiError(`Init failed: ${initResult.message}`)
        }

        steps.init = 'completed'
        stepsCompleted.push('init')
        await emitStepCompleted(telemetryCtx, 'init', performance.now() - stepStart)
      } catch (err) {
        if (err instanceof LinkApiError) throw err
        const msg = err instanceof Error ? err.message : String(err)
        await emitStepFailed(telemetryCtx, 'init', sanitizeErrorMessage(msg))
        throw new LinkApiError(`Init failed: ${msg}`)
      }
    } else {
      steps.init = 'skipped'
      await emitStepSkipped(telemetryCtx, 'init')
    }

    // --- Step 2: Link ---
    console.log(`\n${bold('Linking to Prisma Postgres...')}`)
    const linkStart = performance.now()

    try {
      const link = Link.new()
      const linkResult = await link.link(apiKey, databaseId, baseDir, { force })

      steps.link = 'completed'
      stepsCompleted.push('link')
      telemetryCtx.linkResult = linkResult
      telemetryCtx.databaseId = linkResult.databaseId
      await emitStepCompleted(telemetryCtx, 'link', performance.now() - linkStart)

      console.log(`${green('✔')} Linked to database ${bold(linkResult.databaseId)}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await emitStepFailed(telemetryCtx, 'link', sanitizeErrorMessage(msg))
      throw err
    }

    // Re-detect project state after init + link may have changed files
    const updatedState = detectProjectState(baseDir)

    // Reload config after init may have created prisma.config.ts
    let activeConfig = config
    if (!initialState.hasPrismaConfig && updatedState.hasPrismaConfig) {
      try {
        const { config: reloadedConfig, error } = await loadConfigFromFile({})
        if (!error) {
          activeConfig = reloadedConfig
        }
      } catch {
        console.log(`${yellow('warn')} Could not reload config — using initial config for migrate/seed`)
      }
    }

    // --- Step 3: Migrate (if schema has models) ---
    if (updatedState.hasModels) {
      const shouldMigrate = await confirm({
        message: 'Apply schema to database with prisma migrate dev?',
        default: true,
      })

      if (shouldMigrate) {
        console.log(`\n${bold('Running migration...')}`)
        const migrateStart = performance.now()

        try {
          const migrateDev = MigrateDev.new()
          const migrateResult = await migrateDev.parse(['--name', 'init'], activeConfig, baseDir)

          if (migrateResult instanceof Error) {
            steps.migrate = 'not-applicable'
            console.log(`${yellow('warn')} Migration returned an error: ${sanitizeErrorMessage(migrateResult.message)}`)
            await emitStepFailed(telemetryCtx, 'migrate', sanitizeErrorMessage(migrateResult.message))
          } else {
            steps.migrate = 'completed'
            stepsCompleted.push('migrate')
            await emitStepCompleted(telemetryCtx, 'migrate', performance.now() - migrateStart)
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.log(`${yellow('warn')} Migration failed: ${sanitizeErrorMessage(msg)}`)
          steps.migrate = 'not-applicable'
          await emitStepFailed(telemetryCtx, 'migrate', sanitizeErrorMessage(msg))
        }
      } else {
        steps.migrate = 'skipped'
        await emitStepSkipped(telemetryCtx, 'migrate')
      }
    }

    // --- Step 4: Seed (if seed script exists) ---
    const finalState = detectProjectState(baseDir)
    if (finalState.hasSeedScript) {
      const shouldSeed = await confirm({
        message: 'Seed the database?',
        default: true,
      })

      if (shouldSeed) {
        console.log(`\n${bold('Seeding database...')}`)
        const seedStart = performance.now()

        try {
          const dbSeed = DbSeed.new()
          const seedResult = await dbSeed.parse([], activeConfig)

          if (seedResult instanceof Error) {
            steps.seed = 'not-applicable'
            console.log(`${yellow('warn')} Seed returned an error: ${sanitizeErrorMessage(seedResult.message)}`)
            await emitStepFailed(telemetryCtx, 'seed', sanitizeErrorMessage(seedResult.message))
          } else {
            steps.seed = 'completed'
            stepsCompleted.push('seed')
            await emitStepCompleted(telemetryCtx, 'seed', performance.now() - seedStart)
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.log(`${yellow('warn')} Seed failed: ${sanitizeErrorMessage(msg)}`)
          steps.seed = 'not-applicable'
          await emitStepFailed(telemetryCtx, 'seed', sanitizeErrorMessage(msg))
        }
      } else {
        steps.seed = 'skipped'
        await emitStepSkipped(telemetryCtx, 'seed')
      }
    }

    await emitFlowCompleted(telemetryCtx, stepsCompleted, performance.now() - flowStart)

    return formatBootstrapOutput({
      databaseId: telemetryCtx.linkResult?.databaseId ?? databaseId ?? 'unknown',
      isNewProject: !initialState.hasPackageJson,
      steps,
      hasModels: finalState.hasModels,
    })
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${Bootstrap.help}`)
    }
    return Bootstrap.help
  }
}
