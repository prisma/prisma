import fs from 'node:fs/promises'
import path from 'node:path'

import { ClientGenerator } from '@ork-orm/client'
import { findSchemaFile, getDefaultOutputDir } from '@ork-orm/config'
import { parseSchema } from '@ork-orm/schema-parser'
import { type SchemaAST } from '@ork-orm/schema-parser'
import ora from 'ora'

import type { CommandResult, GenerateOptions } from '../types.js'
import { BaseCommand } from '../utils/command.js'
import { cliLoadOrkConfig } from '../utils/config-error-handler.js'
import { logger } from '../utils/logger.js'

/**
 * Client generation command that integrates with schema parser
 */
export class GenerateCommand extends BaseCommand {
  async execute(options: GenerateOptions = {}): Promise<CommandResult> {
    const spinner = ora('Generating Ork client...').start()

    try {
      // Load configuration using enhanced error handling
      const { config, configDir, configPath } = await cliLoadOrkConfig()

      // Find and read schema file
      const schemaPath = findSchemaFile(config, configDir)
      const schemaContent = await fs.readFile(schemaPath, 'utf-8')

      spinner.text = 'Parsing schema...'

      // Parse schema using schema parser
      const parseResult = parseSchema(schemaContent)

      if (parseResult.errors.length > 0) {
        spinner.fail('Schema parsing failed')
        const errorMessages = parseResult.errors.map((e) => e.message).join(', ')
        logger.error(`Schema parsing errors: ${errorMessages}`)
        return {
          success: false,
          message: `Schema parsing failed: ${errorMessages}`,
        }
      }

      const schemaAST = parseResult.ast

      spinner.text = 'Writing client files...'

      // Determine output directory with smart defaults based on config location
      const outputDir = options.output || config.generator?.output || getDefaultOutputDir(configPath)
      const resolvedOutputDir = path.resolve(configDir, outputDir)

      // Ensure output directory exists
      await fs.mkdir(resolvedOutputDir, { recursive: true })

      // Write client file with pre-compiled operations
      const clientFile = await this.writeGeneratedClientFile(resolvedOutputDir, schemaAST)

      spinner.succeed('Client generation completed successfully!')

      logger.success('✅ Generated Ork client:')
      logger.info(`   Output directory: ${resolvedOutputDir}`)
      logger.info(`   Generated file: ${clientFile}`)
      logger.info('')
      logger.info('💡 Import your client:')
      logger.info(`   import { createClient } from '${path.relative(process.cwd(), resolvedOutputDir)}'`)

      return {
        success: true,
        message: 'Client generated successfully',
      }
    } catch (error) {
      spinner.fail('Client generation failed')
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Generation failed: ${errorMessage}`)

      if (process.env.DEBUG) {
        console.error(error)
      }

      return {
        success: false,
        message: `Generation failed: ${errorMessage}`,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }

  /**
   * Write generated client file with embedded operations
   */
  private async writeGeneratedClientFile(outputDir: string, schemaAST: SchemaAST): Promise<string> {
    const clientPath = path.join(outputDir, 'index.ts')

    try {
      logger.debug('Generating client module with embedded operations')

      // Extract datasource provider from schema AST for dialect detection
      const datasource = schemaAST.datasources?.[0]
      const orkConfig = datasource
        ? {
            database: {
              provider: datasource.provider?.toLowerCase(),
              url: datasource.url,
            },
          }
        : undefined

      // Generate client module with field translations
      const clientGenerator = new ClientGenerator(schemaAST, {
        includeTypes: true,
        includeJSDoc: true,
        esModules: true,
        config: orkConfig,
      })

      const clientContent = clientGenerator.generateClientModule()
      logger.debug(`Client module generated, length: ${clientContent.length}`)

      await fs.writeFile(clientPath, clientContent, 'utf-8')
      logger.debug(`Client module written to: ${clientPath}`)

      return clientPath
    } catch (error) {
      logger.error(`Client generation failed: ${error}`)
      throw error
    }
  }
}

/**
 * Register generate command
 */
export function registerGenerateCommand(program: any) {
  const generateCmd = program
    .command('generate')
    .description('Generate Ork client from schema')
    .option('-o, --output <path>', 'Output directory for generated client')
    .option('-w, --watch', 'Watch for schema changes and regenerate automatically')
    .action(async (options: GenerateOptions) => {
      const command = new GenerateCommand()

      if (options.watch) {
        logger.info('🔄 Watch mode enabled - watching for schema changes...')

        // Import dynamic watch functionality
        const { watch } = await import('node:fs')

        // Initial generation
        await command.run(options)

        try {
          const { config, configDir } = await cliLoadOrkConfig()
          const schemaPath = findSchemaFile(config, configDir)

          // Watch schema file for changes
          watch(schemaPath, async (eventType) => {
            if (eventType === 'change') {
              logger.info('📝 Schema file changed - regenerating client...')
              await command.run(options)
            }
          })

          // Keep process alive in watch mode
          logger.info('👀 Watching for changes... Press Ctrl+C to stop')
          process.stdin.resume()
        } catch (error) {
          logger.error(`Failed to set up watch mode: ${error}`)
          process.exit(1)
        }
      } else {
        // Single generation
        await command.run(options)
      }
    })
}

/**
 * Standalone generation function for programmatic use
 */
export async function generateClient(options: GenerateOptions = {}): Promise<CommandResult> {
  const command = new GenerateCommand()
  return command.execute(options)
}
