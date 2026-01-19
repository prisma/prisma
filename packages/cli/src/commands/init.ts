import { PROVIDER_METADATA, SUPPORTED_PROVIDERS } from '@ork-orm/config'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import prompts from 'prompts'

import { CONFIG_TEMPLATES, generateConfigContent } from '../config/presets.js'
import { generateSchemaContent } from '../templates/schema.js'
import type { CommandResult, InitOptions } from '../types.js'
import { BaseCommand } from '../utils/command.js'
import { detectProviderFromUrl } from '../utils/config.js'
import { cliCreateKyselyFromUrl } from '../utils/config-error-handler.js'
import { logger } from '../utils/logger.js'
import { detectPackageManager, getPackageManager, runInstall } from '../utils/package-manager.js'
import { findViteConfigPath, patchViteConfig } from '../utils/vite-config.js'

const CONFIG_EXTENSIONS = ['.js', '.ts', '.mjs', '.cjs', '.mts', '.cts']

const findExistingConfigPath = (cwd: string): string | null => {
  const directConfig = CONFIG_EXTENSIONS.map((ext) => resolve(cwd, `ork.config${ext}`))
  const nestedConfig = CONFIG_EXTENSIONS.map((ext) => resolve(cwd, '.config', `ork${ext}`))
  const candidates = [...directConfig, ...nestedConfig]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

/**
 * Initialize a new Ork project
 */
export class InitCommand extends BaseCommand {
  async execute(options: InitOptions = {}): Promise<CommandResult> {
    const cwd = process.cwd()

    logger.info('Initializing Ork project...')

    // Check if config already exists using direct filesystem detection
    const existingConfigPath = findExistingConfigPath(cwd)

    if (existingConfigPath && !options.force) {
      return {
        success: false,
        message: `Ork configuration already exists at ${existingConfigPath}. Use --force to overwrite.`,
      }
    }

    // Default to creating ork.config.ts (higher priority location)
    const configPath = resolve(cwd, 'ork.config.ts')

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

    // Ensure type helper dependency for config validation
    await this.ensureConfigDependency(cwd)

    // Generate schema file
    if (!options.skipSchema) {
      await this.generateSchemaFile(cwd, answers)
    }

    const packageJson = this.loadPackageJson(cwd)
    const viteConfigPath = options.skipVite ? null : findViteConfigPath(cwd)
    const isViteProject = this.isViteProject(packageJson, viteConfigPath)

    if (!options.skipInstall) {
      await this.maybeInstallDependencies(cwd, packageJson, answers.provider, isViteProject)
    }

    if (!options.skipVite && viteConfigPath) {
      await this.maybePatchViteConfig(viteConfigPath)
    }

    // Show next steps
    this.showNextSteps(answers, isViteProject)

    return {
      success: true,
      message: 'Ork project initialized successfully!',
    }
  }

  private async promptForConfig(options: InitOptions) {
    const questions: prompts.PromptObject[] = []

    if (options.provider && !SUPPORTED_PROVIDERS.includes(options.provider as (typeof SUPPORTED_PROVIDERS)[number])) {
      throw new Error(`Unsupported provider: ${options.provider}`)
    }

    if (!options.url && !options.provider) {
      questions.push({
        type: 'text',
        name: 'url',
        message: 'Database connection URL (optional):',
        hint: 'Leave blank to select a provider (postgresql, mysql, sqlite, d1)',
      })

      questions.push({
        type: (_prev: unknown, values: { url?: string }) => (values.url?.trim() ? null : 'select'),
        name: 'provider',
        message: 'Select a database provider:',
        choices: SUPPORTED_PROVIDERS.map((provider) => {
          const metadata = PROVIDER_METADATA[provider]
          return {
            title: metadata?.name ?? provider,
            value: provider,
            description: metadata?.description,
          }
        }),
      })
    }

    const answers = await prompts(questions, {
      onCancel: () => {
        logger.error('Initialization cancelled')
        process.exit(1)
      },
    })

    const url = options.url || answers.url || ''

    if (url.trim()) {
      const detectedProvider = detectProviderFromUrl(url)

      if (detectedProvider === 'd1') {
        logger.success(`✓ Auto-detected provider: ${detectedProvider}`)
        logger.warn('Skipping connection verification for D1 (requires Cloudflare Workers bindings)')

        return {
          provider: detectedProvider,
          url,
        }
      }

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
        }
      } catch (error) {
        // Enhanced error handler already provides good error messages
        throw error
      }
    }

    const provider = options.provider || answers.provider

    if (!provider) {
      throw new Error('Database provider is required when no URL is provided')
    }

    logger.success(`✓ Selected provider: ${provider}`)

    return {
      provider,
      url: '',
    }
  }

  private async generateConfigFile(configPath: string, config: { provider: string; url: string }) {
    const configContent = generateConfigContent(config.provider, config.url)
    writeFileSync(configPath, configContent, 'utf8')
    logger.success('Created Ork configuration')
  }

  private async generateSchemaFile(cwd: string, config: { provider: string; url: string }) {
    const schemaPath = resolve(cwd, 'schema.prisma')

    if (existsSync(schemaPath)) {
      logger.info('schema.prisma already exists, skipping...')
      return
    }

    const schemaContent = generateSchemaContent(config.provider, config.url)

    writeFileSync(schemaPath, schemaContent, 'utf8')
    logger.success('Created schema.prisma')
  }

  private showNextSteps(config: { provider: string; url: string }, isViteProject: boolean) {
    const template = CONFIG_TEMPLATES[config.provider]

    logger.info('\n🎉 Project initialized successfully!')
    logger.info('\nNext steps:')
    if (config.url) {
      logger.info('1. Review ork.config.ts and update the database connection if needed')
    } else {
      logger.info('1. Set datasource.url in ork.config.ts (or configure a custom dialect in code)')
    }

    if (template?.installInstructions) {
      logger.info(`2. Install required packages: ${template.installInstructions}`)
    }

    if (isViteProject) {
      logger.info('3. Start your dev server (Ork will auto-generate and migrate): pnpm dev')
    } else {
      logger.info('3. Run your first migration: npx ork migrate dev')
      logger.info('4. Generate the client: npx ork generate')
    }

    if (config.provider === 'd1') {
      logger.info('\n💡 For Cloudflare D1:')
      logger.info('   - Update the d1DatabaseId in ork.config.ts')
      logger.info('   - Use wrangler for local development: wrangler d1 execute')
    }
  }

  private async ensureConfigDependency(cwd: string): Promise<void> {
    const packagePath = resolve(cwd, 'package.json')

    if (!existsSync(packagePath)) {
      logger.info('No package.json found. Install @ork-orm/config for type checking when you add one.')
      return
    }

    try {
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }

      if (packageJson.dependencies?.['@ork-orm/config'] || packageJson.devDependencies?.['@ork-orm/config']) {
        return
      }

      const version = this.getCliVersion()
      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        '@ork-orm/config': version,
      }

      writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8')
      logger.success('Added @ork-orm/config to devDependencies')
    } catch (error) {
      logger.info('Could not update package.json. Install @ork-orm/config for type checking if needed.')
      if (process.env.DEBUG) {
        logger.debug(`package.json update failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  private getCliVersion(): string {
    try {
      if (process.env.npm_package_version) {
        return process.env.npm_package_version
      }

      const binPath = process.argv[1]
      if (!binPath) {
        return '0.0.1-alpha.1'
      }

      const packagePath = resolve(binPath, '..', 'package.json')
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as { version?: string }
      if (packageJson.version) {
        return packageJson.version
      }
    } catch {
      // Fall back to a reasonable default when running from source.
    }

    return '0.0.1-alpha.1'
  }

  private loadPackageJson(cwd: string): {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  } {
    const packagePath = resolve(cwd, 'package.json')

    if (!existsSync(packagePath)) {
      return {}
    }

    try {
      return JSON.parse(readFileSync(packagePath, 'utf8')) as {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }
    } catch {
      return {}
    }
  }

  private isViteProject(
    packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> },
    viteConfigPath: string | null,
  ): boolean {
    const hasViteDependency = Boolean(packageJson.dependencies?.vite) || Boolean(packageJson.devDependencies?.vite)
    return Boolean(viteConfigPath) || hasViteDependency
  }

  private hasDependency(
    packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> },
    name: string,
  ): boolean {
    return Boolean(packageJson.dependencies?.[name] || packageJson.devDependencies?.[name])
  }

  private async maybeInstallDependencies(
    cwd: string,
    packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> },
    provider: string,
    isViteProject: boolean,
  ) {
    if (!existsSync(resolve(cwd, 'package.json'))) {
      logger.info('No package.json found. Skipping dependency installation.')
      return
    }

    const devDeps: string[] = []
    const prodDeps: string[] = []

    if (!this.hasDependency(packageJson, 'ork')) {
      devDeps.push('ork')
    }

    if (isViteProject && !this.hasDependency(packageJson, 'unplugin-ork')) {
      devDeps.push('unplugin-ork')
    }

    const metadata = PROVIDER_METADATA[provider as keyof typeof PROVIDER_METADATA]
    if (metadata) {
      for (const pkg of metadata.packages) {
        if (!this.hasDependency(packageJson, pkg)) {
          prodDeps.push(pkg)
        }
      }
    }

    if (devDeps.length === 0 && prodDeps.length === 0) {
      return
    }

    const managerName = detectPackageManager(cwd)
    const manager = getPackageManager(managerName)

    const messageLines = [
      'Install recommended dependencies now?',
      devDeps.length > 0 ? `Dev: ${devDeps.join(', ')}` : null,
      prodDeps.length > 0 ? `Prod: ${prodDeps.join(', ')}` : null,
    ].filter((line): line is string => Boolean(line))

    const response = await prompts({
      type: 'confirm',
      name: 'install',
      message: messageLines.join('\n'),
      initial: true,
    })

    if (!response.install) {
      if (devDeps.length > 0) {
        const cmd = manager.installDev(devDeps)
        logger.info(`Run: ${cmd.command} ${cmd.args.join(' ')}`)
      }
      if (prodDeps.length > 0) {
        const cmd = manager.installProd(prodDeps)
        logger.info(`Run: ${cmd.command} ${cmd.args.join(' ')}`)
      }
      return
    }

    if (devDeps.length > 0) {
      const cmd = manager.installDev(devDeps)
      await runInstall(cmd.command, cmd.args, cwd)
    }

    if (prodDeps.length > 0) {
      const cmd = manager.installProd(prodDeps)
      await runInstall(cmd.command, cmd.args, cwd)
    }
  }

  private async maybePatchViteConfig(viteConfigPath: string) {
    const currentContent = readFileSync(viteConfigPath, 'utf8')
    if (currentContent.includes('unplugin-ork') || /ork\s*\(/.test(currentContent)) {
      logger.info('Vite config already includes unplugin-ork.')
      return
    }

    const response = await prompts({
      type: 'confirm',
      name: 'patch',
      message: `Update ${viteConfigPath} to enable unplugin-ork?`,
      initial: true,
    })

    if (!response.patch) {
      logger.info(
        "Add the plugin manually: import ork from 'unplugin-ork/vite' and add ork({ autoGenerateClient: true, autoMigrate: true }) to your plugins.",
      )
      return
    }

    const result = patchViteConfig(viteConfigPath)

    if (result.updated) {
      logger.success(`Updated ${viteConfigPath} with unplugin-ork`)
      return
    }

    if (result.reason) {
      logger.warn(`${result.reason}. Add the plugin manually.`)
      return
    }
  }
}

/**
 * Register init command
 */
export function registerInitCommand(program: any) {
  program
    .command('init')
    .description('Initialize a new Ork project')
    .option('--url <url>', 'Database connection URL (provider will be auto-detected)')
    .option('--provider <provider>', 'Database provider when no URL is provided')
    .option('--force', 'Overwrite existing configuration files')
    .option('--skip-schema', 'Skip creating schema.prisma file')
    .option('--skip-install', 'Skip installing dependencies')
    .option('--skip-vite', 'Skip Vite detection and config patching')
    .action(async (options: InitOptions) => {
      const command = new InitCommand()
      await command.run(options)
    })
}
