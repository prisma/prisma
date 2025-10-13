/* import { PROVIDER_URL_PATTERNS } from '@refract/config' - not used, removed for lint */
import { existsSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import prompts from 'prompts'

import { CONFIG_TEMPLATES, generateConfigContent, generateEnvContent } from '../templates/config.js'
import { generateSchemaContent, SCHEMA_TEMPLATES } from '../templates/schema.js'
import type { CommandResult, InitOptions } from '../types.js'
import { BaseCommand } from '../utils/command.js'
import { cliCreateKyselyFromUrl, cliLoadRefractConfig } from '../utils/config-error-handler.js'
import { logger } from '../utils/logger.js'

/**
 * Initialize a new Refract project
 */
export class InitCommand extends BaseCommand {
  async execute(options: InitOptions = {}): Promise<CommandResult> {
    const cwd = process.cwd()

    logger.info('Initializing Refract project...')

    // Check if config already exists using enhanced detection logic
    let existingConfigPath: string | null = null
    try {
      const { configPath } = await cliLoadRefractConfig({ cwd })
      existingConfigPath = configPath
    } catch {
      // No config found - this is expected for new projects
    }

    if (existingConfigPath && !options.force) {
      return {
        success: false,
        message: `Refract configuration already exists at ${existingConfigPath}. Use --force to overwrite.`,
      }
    }

    // Default to creating refract.config.ts (higher priority location)
    const configPath = resolve(cwd, 'refract.config.ts')

    // Interactive prompts for configuration with streamlined auto-detection
    let answers
    try {
      answers = await this.promptForConfig(options)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        message: `Configuration setup failed: ${errorMessage}`,
      }
    }

    // Generate configuration file
    await this.generateConfigFile(configPath, answers)

    // Generate environment file
    if (!options.skipEnv) {
      await this.generateEnvFile(cwd, answers)
    }

    // Generate schema file
    if (!options.skipSchema) {
      await this.generateSchemaFile(cwd, answers)
    }

    // Show next steps
    this.showNextSteps(answers)

    return {
      success: true,
      message: 'Refract project initialized successfully!',
    }
  }

  private async promptForConfig(options: InitOptions) {
    const questions: prompts.PromptObject[] = []

    // Streamlined URL-first approach with auto-detection
    if (!options.url) {
      questions.push({
        type: 'text',
        name: 'url',
        message: 'Database connection URL:',
        hint: 'Provider will be auto-detected (postgresql://, mysql://, file:, d1://)',
        validate: (value: string) => {
          if (!value.trim()) {
            return 'Database URL is required'
          }
          return true // Let the auto-detection handle validation with better error messages
        },
      })
    }

    if (!options.template) {
      questions.push({
        type: 'select',
        name: 'template',
        message: 'Schema template:',
        choices: [
          { title: 'Basic (User & Post)', value: 'basic' },
          { title: 'E-commerce (Product, Order)', value: 'ecommerce' },
          { title: 'Blog (Post, Category, Tag)', value: 'blog' },
        ],
        initial: 0,
      })
    }

    const answers = await prompts(questions, {
      onCancel: () => {
        logger.error('Initialization cancelled')
        process.exit(1)
      },
    })

    const url = options.url || answers.url

    // Use enhanced auto-detection with better error handling
    try {
      const { kysely, config } = await cliCreateKyselyFromUrl(url)

      // Clean up test connection
      await kysely.destroy()

      const provider = config.datasource.provider
      logger.success(`✓ Auto-detected provider: ${provider}`)
      logger.success(`✓ Connection verified successfully`)

      return {
        provider,
        url,
        template: options.template || answers.template || 'basic',
      }
    } catch (error) {
      // Enhanced error handler already provides good error messages
      throw error
    }
  }

  private async generateConfigFile(configPath: string, config: { provider: string; url: string; template: string }) {
    const configContent = generateConfigContent(config.provider, config.url)
    writeFileSync(configPath, configContent, 'utf8')
    logger.success('Created Refract configuration')
  }

  private async generateEnvFile(cwd: string, config: { provider: string; url: string; template: string }) {
    const envPath = resolve(cwd, '.env')

    if (existsSync(envPath)) {
      logger.info('.env already exists, skipping...')
      return
    }

    const envContent = generateEnvContent(config.provider, config.url)
    writeFileSync(envPath, envContent, 'utf8')
    logger.success('Created .env file')
  }

  private async generateSchemaFile(cwd: string, config: { provider: string; url: string; template: string }) {
    const schemaPath = resolve(cwd, 'schema.prisma')

    if (existsSync(schemaPath)) {
      logger.info('schema.prisma already exists, skipping...')
      return
    }

    let schemaContent: string
    if (config.template === 'basic') {
      schemaContent = generateSchemaContent(config.provider)
    } else {
      const template = SCHEMA_TEMPLATES[config.template]
      if (template) {
        schemaContent = template.content.replace(/provider = "postgresql"/, `provider = "${config.provider}"`)
      } else {
        schemaContent = generateSchemaContent(config.provider)
      }
    }

    writeFileSync(schemaPath, schemaContent, 'utf8')
    logger.success(`Created schema.prisma with ${config.template} template`)
  }

  private showNextSteps(config: { provider: string; url: string; template: string }) {
    const template = CONFIG_TEMPLATES[config.provider]

    logger.info('\n🎉 Project initialized successfully!')
    logger.info('\nNext steps:')
    logger.info('1. Update your .env file with your actual database credentials')

    if (template?.installInstructions) {
      logger.info(`2. Install required packages: ${template.installInstructions}`)
    }

    logger.info('3. Run your first migration: npx refract migrate dev')
    logger.info('4. Generate the client: npx refract generate')
    logger.info('5. Start building your application!')

    if (config.provider === 'd1') {
      logger.info('\n💡 For Cloudflare D1:')
      logger.info('   - Update the d1DatabaseId in refract.config.ts')
      logger.info('   - Use wrangler for local development: wrangler d1 execute')
    }
  }
}

/**
 * Register init command
 */
export function registerInitCommand(program: any) {
  program
    .command('init')
    .description('Initialize a new Refract project with automatic provider detection')
    .option('--url <url>', 'Database connection URL (provider will be auto-detected)')
    .option('--template <template>', 'Schema template: basic, ecommerce, or blog (default: basic)')
    .option('--force', 'Overwrite existing configuration files')
    .option('--skip-env', 'Skip creating .env file')
    .option('--skip-schema', 'Skip creating schema.prisma file')
    .action(async (options: InitOptions) => {
      const command = new InitCommand()
      await command.run(options)
    })
}
