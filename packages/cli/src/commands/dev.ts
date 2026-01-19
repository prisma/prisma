import { watch } from 'node:fs'

import { findSchemaFile } from '@ork-orm/config'
import { OrkMigrate } from '@ork-orm/migrate'

import type { CommandResult, DevOptions } from '../types.js'
import { BaseCommand } from '../utils/command.js'
import { cliCreateKyselyFromConfig, cliLoadOrkConfig } from '../utils/config-error-handler.js'
import { logger } from '../utils/logger.js'
import { generateClient } from './generate.js'

type RunState = {
  running: boolean
  pending: boolean
}

const createRunState = (): RunState => ({ running: false, pending: false })

export class DevCommand extends BaseCommand {
  async execute(options: DevOptions = {}): Promise<CommandResult> {
    if (options.noGenerate && options.noMigrate) {
      return {
        success: false,
        message: 'Cannot skip both generation and migrations in dev mode.',
      }
    }

    const { config, configDir } = await cliLoadOrkConfig()
    const schemaPath = findSchemaFile(config, configDir)

    logger.info('Starting Ork dev loop...')
    logger.info(`Watching schema: ${schemaPath}`)

    const runState = createRunState()
    const runAll = async () => {
      if (runState.running) {
        runState.pending = true
        return
      }

      runState.running = true

      try {
        if (!options.noGenerate) {
          const result = await generateClient()
          if (!result.success) {
            throw result.error || new Error(result.message || 'Client generation failed')
          }
        }

        if (!options.noMigrate) {
          await this.runMigrations(options)
        }
      } finally {
        runState.running = false
        if (runState.pending) {
          runState.pending = false
          await runAll()
        }
      }
    }

    await runAll()

    watch(schemaPath, async (eventType) => {
      if (eventType !== 'change') {
        return
      }

      logger.info('Schema change detected, running dev loop...')
      await runAll()
    })

    logger.info('Dev loop running. Press Ctrl+C to stop.')
    process.stdin.resume()

    return {
      success: true,
      message: 'Dev loop running',
    }
  }

  private async runMigrations(options: DevOptions): Promise<void> {
    const { kysely, config, configDir } = await cliCreateKyselyFromConfig()
    const schemaPath = findSchemaFile(config, configDir)
    const migrate = new OrkMigrate({
      useTransaction: true,
      validateSchema: true,
      timeout: 30000,
    })

    try {
      const preview = await migrate.generateMigrationPreview(kysely, schemaPath)

      if (preview.statements.length === 0) {
        logger.success('No migration changes detected. Database is up to date!')
        return
      }

      if (preview.riskAssessment.level === 'high' && !options.unsafe) {
        logger.warn('Destructive migration detected. Re-run with --unsafe to apply changes.')
        return
      }

      const promptConfig = {
        enabled: !options.yes,
        minimumRiskLevel: options.unsafe ? 'low' : 'medium',
        showDetailedSummary: false,
        requireExplicitConfirmation: !options.yes,
      } as const

      const result = await migrate.applyWithConfirmation(kysely, schemaPath, promptConfig, {
        level: 'info',
        logStatements: true,
        logExecutionTimes: true,
        logProgress: true,
      })

      if (result.success) {
        logger.success(
          `Migration completed successfully! (${result.statementsExecuted} statements executed in ${result.executionTime}ms)`,
        )
      } else if (result.errors.length > 0) {
        logger.error(`Migration failed: ${result.errors.map((e) => e.message).join(', ')}`)
      }
    } finally {
      await kysely.destroy()
    }
  }
}

export function registerDevCommand(program: any) {
  program
    .command('dev')
    .description('Run the Ork dev loop (generate + migrate on schema changes)')
    .option('-y, --yes', 'Skip confirmation prompts')
    .option('--unsafe', 'Allow destructive migrations')
    .option('--no-generate', 'Skip client generation')
    .option('--no-migrate', 'Skip migrations')
    .action(async (options: DevOptions) => {
      const command = new DevCommand()
      await command.run(options)
    })
}
