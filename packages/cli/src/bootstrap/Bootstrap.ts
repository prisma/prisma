import { type ChildProcess, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { confirm } from '@inquirer/prompts'
import type { PrismaConfigInternal } from '@prisma/config'
import { loadConfigFromFile } from '@prisma/config'
import type { Command } from '@prisma/internals'
import { arg, format, HelpError, isError } from '@prisma/internals'
import { DbSeed, MigrateDev } from '@prisma/migrate'
import * as checkpoint from 'checkpoint-client'
import { bold, dim, green, red, yellow } from 'kleur/colors'
import ora from 'ora'

import { Generate } from '../Generate'
import { Init } from '../Init'
import { Link, type LinkResult } from '../postgres/link/Link'
import { isAlreadyLinked } from '../postgres/link/local-setup'
import { LinkApiError, sanitizeErrorMessage } from '../postgres/link/management-api'
import { type BootstrapStepStatus, formatBootstrapOutput } from './completion-output'
import { detectProjectState, getModelNames, getSeedCommand } from './project-state'
import {
  emitFlowCompleted,
  emitFlowFailed,
  emitFlowStarted,
  emitStepCompleted,
  emitStepFailed,
  emitStepSkipped,
  extractErrorClass,
  type TelemetryContext,
} from './telemetry'
import {
  addDependencies,
  addDevDependencies,
  detectPackageManager,
  downloadAndExtractTemplate,
  installDependencies,
  isValidTemplateName,
  promptTemplateSelection,
} from './template-scaffold'

function findLocalPrismaBin(baseDir: string): string | null {
  const candidate = path.join(baseDir, 'node_modules', '.bin', 'prisma')
  return fs.existsSync(candidate) ? candidate : null
}

interface SubprocessResult {
  exitCode: number
  stderr: string
}

/**
 * Runs a Prisma CLI command using the user's locally installed binary.
 * Streams stdout/stderr to the terminal so the user sees real-time output,
 * while also capturing stderr for telemetry and error classification.
 */
function runLocalPrismaCommand(
  bin: string,
  args: string[],
  baseDir: string,
  extraEnv?: Record<string, string>,
): Promise<SubprocessResult> {
  return new Promise((resolve, reject) => {
    const stderrChunks: Buffer[] = []
    const child: ChildProcess = spawn(bin, args, {
      cwd: baseDir,
      env: { ...process.env, ...extraEnv },
      stdio: ['inherit', 'inherit', 'pipe'],
      shell: process.platform === 'win32',
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(chunk)
      stderrChunks.push(chunk)
    })

    child.on('error', (err) => reject(err))
    child.on('close', (code) => {
      resolve({
        exitCode: code ?? 1,
        stderr: Buffer.concat(stderrChunks).toString('utf-8'),
      })
    })
  })
}

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
  --template     Starter template name (e.g. nextjs, express)
  --force        Re-link even if already linked to Prisma Postgres
  -h, --help     Display this help message

${bold('Examples')}

  Interactive (opens browser, guides you through setup)
  ${dim('$')} prisma bootstrap

  Non-interactive with explicit credentials
  ${dim('$')} prisma bootstrap --api-key "<your-api-key>" --database "db_..."

  With a starter template
  ${dim('$')} prisma bootstrap --template nextjs
`)

  public async parse(argv: string[], config: PrismaConfigInternal, baseDir: string): Promise<string | Error> {
    const args = arg(argv, {
      '--api-key': String,
      '--database': String,
      '--template': String,
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
    const templateName = args['--template']
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

    if (templateName && !isValidTemplateName(templateName)) {
      return new HelpError(
        `\n${bold(red('!'))} Unknown template "${templateName}". Available templates: nextjs, express, hono, fastify, nuxt, sveltekit, remix, react-router-7, astro, nest\n${Bootstrap.help}`,
      )
    }

    try {
      return await this.run(apiKey, databaseId, templateName, force, config, baseDir)
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
    templateName: string | undefined,
    force: boolean,
    config: PrismaConfigInternal,
    baseDir: string,
  ): Promise<string | HelpError> {
    const flowStart = performance.now()
    const stepsCompleted: string[] = []
    const steps: BootstrapStepStatus = {
      init: 'skipped',
      template: 'not-applicable',
      link: 'skipped',
      generate: 'not-applicable',
      migrate: 'not-applicable',
      seed: 'not-applicable',
    }

    const scriptedMode = Boolean(apiKey) && Boolean(databaseId)

    let distinctId: string
    try {
      distinctId = await checkpoint.getSignature()
    } catch {
      distinctId = 'unknown'
    }

    const initialState = detectProjectState(baseDir)

    const telemetryCtx: TelemetryContext = {
      distinctId,
      databaseId,
      linkResult: null,
      projectState: initialState,
      isScriptedInvocation: scriptedMode,
      baseDir,
    }

    await emitFlowStarted(telemetryCtx)

    let failedStep: string | null = null
    let failedStderr = ''

    try {
      let templateScaffolded = false
      const isEmptyProject = !initialState.hasSchemaFile && !initialState.hasPackageJson

      // --- Step 1: Init or Template ---
      if (!initialState.hasSchemaFile) {
        if (isEmptyProject) {
          if (!scriptedMode) {
            console.log(`\n${yellow('!')} No project found in this directory.`)
            console.log(`  A ${bold('package.json')} is required for Prisma to work.`)
            console.log(
              `  Initialize one with: ${dim('npm init -y')}, ${dim('pnpm init')}, ${dim('yarn init')}, or ${dim('bun init')}\n`,
            )
          }

          let resolvedTemplate = templateName
          if (!resolvedTemplate && scriptedMode) {
            resolvedTemplate = 'nextjs'
            console.log(
              `\n${dim('ℹ')} Defaulting to ${bold('nextjs')} template — pass ${bold('--template <name>')} to override`,
            )
          } else if (!resolvedTemplate) {
            resolvedTemplate = await this.askAboutTemplate()
          }

          if (resolvedTemplate) {
            await this.scaffoldTemplate(resolvedTemplate, baseDir, steps, stepsCompleted, telemetryCtx)
            templateScaffolded = steps.template === 'completed'
            if (!templateScaffolded) {
              return new HelpError(
                `\n${bold(red('!'))} Template download failed and no project exists to fall back to.\n\nInitialize a project first, then re-run ${bold('prisma bootstrap')}:\n  ${dim('$')} npm init -y ${dim('  (or pnpm init / yarn init / bun init)')}\n  ${dim('$')} npx prisma bootstrap`,
              )
            }
          } else {
            return new HelpError(
              `\n${bold(red('!'))} Cannot proceed without a project.\n\nInitialize a project first, then re-run ${bold('prisma bootstrap')}:\n  ${dim('$')} npm init -y ${dim('  (or pnpm init / yarn init / bun init)')}\n  ${dim('$')} npx prisma bootstrap`,
            )
          }
        } else if (templateName) {
          await this.scaffoldTemplate(templateName, baseDir, steps, stepsCompleted, telemetryCtx)
          templateScaffolded = steps.template === 'completed'
          if (!templateScaffolded) {
            console.log(`${dim('  Falling back to prisma init...')}`)
            await this.runInit(
              steps,
              stepsCompleted,
              telemetryCtx,
              config,
              scriptedMode || (await this.askAboutSampleModel()),
            )
          }
        } else {
          steps.template = 'not-applicable'
          await this.runInit(
            steps,
            stepsCompleted,
            telemetryCtx,
            config,
            scriptedMode || (await this.askAboutSampleModel()),
          )
        }
      } else {
        steps.init = 'skipped'
        steps.template = 'not-applicable'
        await emitStepSkipped(telemetryCtx, 'init')
      }

      // Re-detect project state after init/template may have changed files
      const updatedState = detectProjectState(baseDir)

      // --- Deps gate (moved before link to prevent the dotenv landmine) ---
      //
      // prisma.config.ts imports dotenv/config, so dotenv must be installed
      // before any step that loads the config. If deps aren't installed and
      // link fails (auth error, network, Ctrl-C), re-running `prisma bootstrap`
      // would crash at config load with "Cannot find module 'dotenv/config'".
      const missingDevDeps: string[] = []
      const missingDeps: string[] = []
      if (!templateScaffolded) {
        for (const pkg of ['dotenv', 'prisma']) {
          if (!fs.existsSync(path.join(baseDir, 'node_modules', pkg))) {
            missingDevDeps.push(pkg)
          }
        }
        if (!fs.existsSync(path.join(baseDir, 'node_modules', '@prisma', 'client'))) {
          missingDeps.push('@prisma/client')
        }
      }

      const allMissing = [...missingDevDeps, ...missingDeps]

      if (allMissing.length > 0) {
        const pm = detectPackageManager(baseDir)
        const depsLabel = bold(allMissing.join(', '))

        const manualInstallAndReturn = () => {
          console.log(`\n  Install them manually, then re-run:`)
          if (missingDeps.length > 0) {
            const installHint =
              pm === 'npm' ? `npm install ${missingDeps.join(' ')}` : `${pm} add ${missingDeps.join(' ')}`
            console.log(`  ${dim('$')} ${installHint}`)
          }
          if (missingDevDeps.length > 0) {
            const installHint =
              pm === 'npm'
                ? `npm install --save-dev ${missingDevDeps.join(' ')}`
                : `${pm} add -D ${missingDevDeps.join(' ')}`
            console.log(`  ${dim('$')} ${installHint}`)
          }
          console.log(`  ${dim('$')} npx prisma@latest bootstrap`)

          return formatBootstrapOutput({
            databaseId: telemetryCtx.linkResult?.databaseId ?? databaseId ?? 'unknown',
            isNewProject: !initialState.hasPackageJson,
            steps,
            hasModels: updatedState.hasModels,
            pendingDepsInstall: true,
          })
        }

        if (pm === 'deno') {
          return manualInstallAndReturn()
        }

        const shouldInstall =
          scriptedMode ||
          (await confirm({
            message: `Install missing Prisma dependencies (${allMissing.join(', ')}) with ${pm}?`,
            default: true,
          }))

        if (shouldInstall) {
          const installSpinner = ora(`Installing ${depsLabel}...`).start()
          try {
            if (missingDeps.length > 0) {
              await addDependencies(baseDir, missingDeps)
            }
            if (missingDevDeps.length > 0) {
              await addDevDependencies(baseDir, missingDevDeps)
            }
            installSpinner.succeed(`Prisma dependencies installed`)
            stepsCompleted.push('deps')
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            installSpinner.fail(`Failed to install dependencies: ${sanitizeErrorMessage(msg)}`)
            return manualInstallAndReturn()
          }
        } else {
          return manualInstallAndReturn()
        }
      }

      // Reload config after deps are installed — prisma.config.ts imports
      // dotenv/config, so this must happen after the deps gate above.
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

      // --- Step 2: Link ---
      if (!force && isAlreadyLinked(baseDir)) {
        console.log(`\n${green('✔')} Already linked to Prisma Postgres`)
        if (databaseId) {
          console.log(`  ${dim('Skipping link — use --force to relink to a different database')}`)
        }
        steps.link = 'skipped'
        await emitStepSkipped(telemetryCtx, 'link')
      } else {
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
      }

      // --- Step 3: Install dependencies (template path only) ---
      if (templateScaffolded) {
        const installSpinner = ora('Installing dependencies...').start()
        try {
          await installDependencies(baseDir)
          installSpinner.succeed('Dependencies installed')
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          installSpinner.fail(`Dependency install failed: ${sanitizeErrorMessage(msg)}`)
          await emitStepFailed(telemetryCtx, 'install_deps', sanitizeErrorMessage(msg))
          return new HelpError(
            `\n${bold(red('!'))} Dependency installation failed. Please install dependencies manually and re-run ${bold('prisma bootstrap')}.`,
          )
        }
      }

      // Ensure DATABASE_URL is available for config loading and subprocesses.
      let databaseUrl = telemetryCtx.linkResult?.connectionString
      if (!databaseUrl) {
        const envPath = path.join(baseDir, '.env')
        if (fs.existsSync(envPath)) {
          const envContent = fs.readFileSync(envPath, 'utf-8')
          const match = envContent.match(/^DATABASE_URL=["']?([^"'\n]+)["']?/m)
          if (match) databaseUrl = match[1]
        }
      }
      if (databaseUrl) {
        process.env.DATABASE_URL = databaseUrl
      }
      const subprocessEnv: Record<string, string> = databaseUrl ? { DATABASE_URL: databaseUrl } : {}

      // --- Step 4: Migrate (if schema has models) ---
      //
      // When a local `prisma` binary exists, we shell out to it so that
      // migrate/seed run with the user's own Prisma version. We only fall
      // back to in-process execution for fresh projects where no local binary exists.
      //
      // Note: scripted mode skips bootstrap's own confirm() prompts but does NOT
      // suppress prompts inside `prisma migrate dev` (e.g. drift-detection reset).
      // Those are the sub-command's responsibility and surface as non-zero exits.
      const finalState = detectProjectState(baseDir)
      const localPrismaBin = findLocalPrismaBin(baseDir)
      const useLocalBin = localPrismaBin !== null && (initialState.hasSchemaFile || templateScaffolded)

      if (finalState.hasModels) {
        const modelNames = getModelNames(baseDir)
        const modelCount = modelNames.length
        const modelSummary =
          modelCount > 0 ? ` ${modelCount} model${modelCount === 1 ? '' : 's'} (${modelNames.join(', ')})` : ' schema'

        const shouldMigrate =
          scriptedMode ||
          (await confirm({
            message: `Apply${modelSummary} to database with prisma migrate dev?`,
            default: true,
          }))

        if (shouldMigrate) {
          console.log(`\n${bold('Running migration...')}`)
          const migrateStart = performance.now()

          try {
            if (useLocalBin && localPrismaBin) {
              const result = await runLocalPrismaCommand(
                localPrismaBin,
                ['migrate', 'dev', '--name', 'init'],
                baseDir,
                subprocessEnv,
              )
              if (result.exitCode !== 0) {
                steps.migrate = 'failed'
                failedStep = 'migrate'
                failedStderr = result.stderr
                console.log(`${yellow('warn')} Migration failed (exit code ${result.exitCode})`)
                await emitStepFailed(
                  telemetryCtx,
                  'migrate',
                  result.stderr.slice(0, 500) || `exit code ${result.exitCode}`,
                )
              }
            } else {
              const migrateDev = MigrateDev.new()
              const migrateResult = await migrateDev.parse(['--name', 'init'], activeConfig, baseDir)

              if (migrateResult instanceof Error) {
                steps.migrate = 'failed'
                failedStep = 'migrate'
                failedStderr = migrateResult.message
                console.log(`${yellow('warn')} Migration failed: ${sanitizeErrorMessage(migrateResult.message)}`)
                await emitStepFailed(telemetryCtx, 'migrate', sanitizeErrorMessage(migrateResult.message))
              }
            }

            if (steps.migrate !== 'failed') {
              steps.migrate = 'completed'
              stepsCompleted.push('migrate')
              await emitStepCompleted(telemetryCtx, 'migrate', performance.now() - migrateStart)
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.log(`${yellow('warn')} Migration failed: ${sanitizeErrorMessage(msg)}`)
            steps.migrate = 'failed'
            failedStep = 'migrate'
            failedStderr = msg
            await emitStepFailed(telemetryCtx, 'migrate', sanitizeErrorMessage(msg))
          }
        } else {
          steps.migrate = 'skipped'
          await emitStepSkipped(telemetryCtx, 'migrate')
        }
      }

      // --- Step 5: Generate ---
      if (!failedStep) {
        console.log(`\n${bold('Generating Prisma Client...')}`)
        const generateStart = performance.now()

        try {
          if (useLocalBin && localPrismaBin) {
            const result = await runLocalPrismaCommand(localPrismaBin, ['generate'], baseDir, subprocessEnv)
            if (result.exitCode !== 0) {
              steps.generate = 'failed'
              failedStep = 'generate'
              failedStderr = result.stderr
              console.log(`${yellow('warn')} Generate failed (exit code ${result.exitCode})`)
              await emitStepFailed(
                telemetryCtx,
                'generate',
                result.stderr.slice(0, 500) || `exit code ${result.exitCode}`,
              )
            }
          } else {
            const generate = Generate.new()
            const generateResult = await generate.parse([], activeConfig)

            if (generateResult instanceof Error) {
              steps.generate = 'failed'
              failedStep = 'generate'
              failedStderr = generateResult.message
              console.log(`${yellow('warn')} Generate failed: ${sanitizeErrorMessage(generateResult.message)}`)
              await emitStepFailed(telemetryCtx, 'generate', sanitizeErrorMessage(generateResult.message))
            }
          }

          if (steps.generate !== 'failed') {
            steps.generate = 'completed'
            stepsCompleted.push('generate')
            await emitStepCompleted(telemetryCtx, 'generate', performance.now() - generateStart)
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          console.log(`${yellow('warn')} Generate failed: ${sanitizeErrorMessage(msg)}`)
          steps.generate = 'failed'
          failedStep = 'generate'
          failedStderr = msg
          await emitStepFailed(telemetryCtx, 'generate', sanitizeErrorMessage(msg))
        }
      }

      // --- Step 6: Seed (if seed script exists) ---
      if (!failedStep && finalState.hasSeedScript) {
        const seedCmd = getSeedCommand(baseDir)
        const seedHint = seedCmd ? dim(` → ${seedCmd}`) : ''

        const shouldSeed =
          scriptedMode ||
          (await confirm({
            message: `Seed the database?${seedHint}`,
            default: true,
          }))

        if (shouldSeed) {
          console.log(`\n${bold('Seeding database...')}`)
          const seedStart = performance.now()

          try {
            if (useLocalBin && localPrismaBin) {
              const result = await runLocalPrismaCommand(localPrismaBin, ['db', 'seed'], baseDir, subprocessEnv)
              if (result.exitCode !== 0) {
                steps.seed = 'failed'
                failedStep = 'seed'
                failedStderr = result.stderr
                console.log(`${yellow('warn')} Seed failed (exit code ${result.exitCode})`)
                await emitStepFailed(
                  telemetryCtx,
                  'seed',
                  result.stderr.slice(0, 500) || `exit code ${result.exitCode}`,
                )
              }
            } else {
              const dbSeed = DbSeed.new()
              const seedResult = await dbSeed.parse([], activeConfig)

              if (seedResult instanceof Error) {
                steps.seed = 'failed'
                failedStep = 'seed'
                failedStderr = seedResult.message
                console.log(`${yellow('warn')} Seed failed: ${sanitizeErrorMessage(seedResult.message)}`)
                await emitStepFailed(telemetryCtx, 'seed', sanitizeErrorMessage(seedResult.message))
              }
            }

            if (steps.seed !== 'failed') {
              steps.seed = 'completed'
              stepsCompleted.push('seed')
              await emitStepCompleted(telemetryCtx, 'seed', performance.now() - seedStart)
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            console.log(`${yellow('warn')} Seed failed: ${sanitizeErrorMessage(msg)}`)
            steps.seed = 'failed'
            failedStep = 'seed'
            failedStderr = msg
            await emitStepFailed(telemetryCtx, 'seed', sanitizeErrorMessage(msg))
          }
        } else {
          steps.seed = 'skipped'
          await emitStepSkipped(telemetryCtx, 'seed')
        }
      }

      if (failedStep) {
        const errorClass = extractErrorClass(failedStderr)
        await emitFlowFailed(
          telemetryCtx,
          failedStep,
          errorClass,
          failedStderr,
          stepsCompleted,
          performance.now() - flowStart,
        )
        return new HelpError(
          `\n${bold(red('!'))} Bootstrap failed at ${bold(failedStep)} step. See the output above for details.`,
        )
      }

      await emitFlowCompleted(telemetryCtx, stepsCompleted, performance.now() - flowStart)
      return formatBootstrapOutput({
        databaseId: telemetryCtx.linkResult?.databaseId ?? databaseId ?? 'unknown',
        isNewProject: !initialState.hasPackageJson,
        steps,
        hasModels: finalState.hasModels,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await emitFlowFailed(
        telemetryCtx,
        failedStep ?? 'unknown',
        extractErrorClass(msg),
        msg,
        stepsCompleted,
        performance.now() - flowStart,
      )
      throw err
    }
  }

  private async askAboutTemplate(): Promise<string | null> {
    const wantsTemplate = await confirm({
      message: 'Create a starter app from a template?',
      default: true,
    })

    if (!wantsTemplate) return null
    return promptTemplateSelection()
  }

  private async askAboutSampleModel(): Promise<boolean> {
    return confirm({
      message: 'Add a sample User model to get started?',
      default: true,
    })
  }

  private async scaffoldTemplate(
    templateName: string,
    baseDir: string,
    steps: BootstrapStepStatus,
    stepsCompleted: string[],
    telemetryCtx: TelemetryContext,
  ): Promise<void> {
    const spinner = ora(`Downloading ${bold(templateName)} template...`).start()
    const stepStart = performance.now()

    try {
      await downloadAndExtractTemplate(templateName, baseDir)
      spinner.succeed(`Template ${bold(templateName)} scaffolded`)
      steps.template = 'completed'
      steps.init = 'skipped'
      stepsCompleted.push('template')
      await emitStepCompleted(telemetryCtx, 'template', performance.now() - stepStart)
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'TimeoutError'
      const msg = isTimeout
        ? 'Download timed out — check your network connection and try again'
        : err instanceof Error
          ? err.message
          : String(err)
      spinner.fail(`Template download failed: ${sanitizeErrorMessage(msg)}`)
      steps.template = 'failed'
      await emitStepFailed(telemetryCtx, 'template', sanitizeErrorMessage(msg))
    }
  }

  private async runInit(
    steps: BootstrapStepStatus,
    stepsCompleted: string[],
    telemetryCtx: TelemetryContext,
    config: PrismaConfigInternal,
    withModel: boolean,
  ): Promise<void> {
    const label = withModel ? 'Setting up Prisma with a sample User model...' : 'Setting up Prisma...'
    console.log(`\n${bold(label)}`)
    const stepStart = performance.now()

    try {
      const init = Init.new()
      const initArgs = ['--datasource-provider', 'postgresql']
      if (withModel) initArgs.push('--with-model')
      const initResult = await init.parse(initArgs, config)

      if (initResult instanceof Error) {
        await emitStepFailed(telemetryCtx, 'init', sanitizeErrorMessage(initResult.message))
        throw new Error(`Init failed: ${initResult.message}`)
      }

      steps.init = 'completed'
      stepsCompleted.push('init')
      await emitStepCompleted(telemetryCtx, 'init', performance.now() - stepStart)
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Init failed:')) throw err
      const msg = err instanceof Error ? err.message : String(err)
      await emitStepFailed(telemetryCtx, 'init', sanitizeErrorMessage(msg))
      throw new Error(`Init failed: ${msg}`)
    }
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${Bootstrap.help}`)
    }
    return Bootstrap.help
  }
}
