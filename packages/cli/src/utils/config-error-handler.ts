import type { ConfigLoadOptions, ConfigLoadResult, KyselyResult } from '@refract/config'
import {
  loadRefractConfig,
  createKyselyFromConfig,
  createKyselyFromUrl,
  createKyselyDialect,
  validateConnection,
  PROVIDER_METADATA,
  SUPPORTED_PROVIDERS,
  type DatabaseProvider,
} from '@refract/config'

import { logger } from './logger.js'

/**
 * Enhanced error handling wrapper for @refract/config functions
 * Provides actionable error messages and suggestions for common issues
 */
export class ConfigErrorHandler {
  /**
   * Load Refract configuration with enhanced error handling
   */
  static async loadRefractConfig(options?: ConfigLoadOptions): Promise<ConfigLoadResult> {
    try {
      return await loadRefractConfig(options)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Configuration file not found
      if (errorMessage.includes('configuration file not found') || errorMessage.includes('ENOENT')) {
        logger.errorWithSuggestions('No Refract configuration file found', [
          'Run `npx refract init` to create a new project',
          'Create refract.config.ts manually in your project root',
          "Check that you're in the correct directory",
          'Ensure the configuration file has proper ESM exports',
        ])
        throw new Error('Configuration file not found')
      }

      // ESM/CommonJS module issues
      if (errorMessage.includes('require() of ES modules') || errorMessage.includes('import()')) {
        logger.errorWithSuggestions('Module resolution error in configuration file', [
          'Ensure your project has "type": "module" in package.json',
          'Use .mjs extension for configuration files in CommonJS projects',
          'Check that all imports use proper ESM syntax',
          'Verify TypeScript configuration supports ESM',
        ])
        throw new Error('ESM module resolution error')
      }

      // Missing dialect packages
      if (
        errorMessage.includes('Cannot find module') &&
        (errorMessage.includes('pg') || errorMessage.includes('mysql2') || errorMessage.includes('better-sqlite3'))
      ) {
        const missingPackage = this.extractMissingPackage(errorMessage)
        const installCmd = this.getInstallCommand(missingPackage)

        logger.errorWithSuggestions(`Missing database driver: ${missingPackage}`, [
          `Install the driver: ${installCmd}`,
          'Add the package to your project dependencies',
          'Check that the package version is compatible',
          'Restart your development server after installation',
        ])
        throw new Error(`Missing database driver: ${missingPackage}`)
      }

      // Configuration syntax errors
      if (errorMessage.includes('SyntaxError') || errorMessage.includes('parse')) {
        logger.errorWithSuggestions('Syntax error in configuration file', [
          'Check your refract.config.ts for syntax errors',
          'Ensure proper TypeScript/JavaScript syntax',
          'Verify all imports and exports are correct',
          'Use a TypeScript checker or ESLint to validate syntax',
        ])
        throw new Error('Configuration syntax error')
      }

      // Invalid configuration schema
      if (errorMessage.includes('validation') || errorMessage.includes('schema')) {
        logger.errorWithSuggestions('Invalid configuration format', [
          'Check that your configuration matches the expected schema',
          'Ensure provider is one of: ' + SUPPORTED_PROVIDERS.join(', '),
          'Verify connection URL format is correct',
          'Use defineConfig() helper for type safety',
        ])
        throw new Error('Configuration schema validation failed')
      }

      // Generic error
      logger.errorWithSuggestions(`Configuration loading failed: ${errorMessage}`, [
        'Check the configuration file syntax and format',
        'Ensure all required packages are installed',
        'Verify environment variables are set correctly',
        'Run with DEBUG=1 for more detailed error information',
      ])
      throw error
    }
  }

  /**
   * Create Kysely instance from configuration with enhanced error handling
   */
  static async createKyselyFromConfig(options?: ConfigLoadOptions): Promise<KyselyResult> {
    try {
      return await createKyselyFromConfig(options)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Database connection errors
      if (errorMessage.includes('connection') || errorMessage.includes('ECONNREFUSED')) {
        logger.errorWithSuggestions('Database connection failed', [
          'Verify your database server is running',
          'Check connection URL and credentials',
          'Ensure database exists and is accessible',
          'Check firewall and network settings',
          'Verify SSL/TLS configuration if required',
        ])
        throw new Error('Database connection failed')
      }

      // Authentication errors
      if (
        errorMessage.includes('authentication') ||
        errorMessage.includes('password') ||
        errorMessage.includes('auth')
      ) {
        logger.errorWithSuggestions('Database authentication failed', [
          'Check your database username and password',
          'Verify connection URL includes correct credentials',
          'Ensure database user has required permissions',
          'Check that the database allows connections from your IP',
        ])
        throw new Error('Database authentication failed')
      }

      // Missing environment variables
      if (errorMessage.includes('DATABASE_URL') || errorMessage.includes('environment variable')) {
        logger.errorWithSuggestions('Missing required environment variables', [
          'Set DATABASE_URL in your environment (shell, CI, or runtime config)',
          'Verify the variable is available to your process',
          'Verify variable names match your configuration',
        ])
        throw new Error('Missing environment variables')
      }

      // First try to load config to provide better context
      await this.loadRefractConfig(options)
      throw error
    }
  }

  /**
   * Create Kysely instance from URL with enhanced error handling
   */
  static async createKyselyFromUrl(url: string): Promise<KyselyResult> {
    try {
      return await createKyselyFromUrl(url)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Invalid URL format
      if (errorMessage.includes('Invalid URL') || errorMessage.includes('protocol')) {
        logger.errorWithSuggestions('Invalid database URL format', [
          'Use format: protocol://user:password@host:port/database',
          'Supported protocols: postgresql://, mysql://, file:, d1://',
          'Ensure all URL components are properly encoded',
          'Check for typos in the connection string',
        ])
        throw new Error('Invalid database URL format')
      }

      // Unsupported provider
      if (errorMessage.includes('Unsupported provider') || errorMessage.includes('provider')) {
        const supportedList = SUPPORTED_PROVIDERS.join(', ')
        logger.errorWithSuggestions('Unsupported database provider', [
          `Supported providers: ${supportedList}`,
          'Check that the URL protocol matches a supported provider',
          'Verify the provider is correctly detected from the URL',
          'Use a supported database connection format',
        ])
        throw new Error('Unsupported database provider')
      }

      // Missing driver packages
      if (errorMessage.includes('Cannot find module')) {
        const missingPackage = this.extractMissingPackage(errorMessage)
        const installCmd = this.getInstallCommand(missingPackage)

        logger.errorWithSuggestions(`Missing database driver for URL: ${missingPackage}`, [
          `Install the driver: ${installCmd}`,
          'Add the driver as a dependency in package.json',
          'Restart your application after installation',
        ])
        throw new Error(`Missing database driver: ${missingPackage}`)
      }

      throw error
    }
  }

  /**
   * Create Kysely dialect with enhanced error handling
   */
  static async createKyselyDialect(provider: DatabaseProvider, connectionString: string) {
    try {
      return await createKyselyDialect(provider, connectionString)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const metadata = PROVIDER_METADATA[provider]

      if (errorMessage.includes('Cannot find module')) {
        const installCmd = metadata?.installCommand || `npm install ${metadata?.packageName}`

        logger.errorWithSuggestions(`Missing ${provider} database driver`, [
          `Install the driver: ${installCmd}`,
          `Add ${metadata?.packageName} to your dependencies`,
          'Restart your development server after installation',
        ])
        throw new Error(`Missing ${provider} driver`)
      }

      throw error
    }
  }

  /**
   * Validate database connection with enhanced error handling
   */
  static async validateConnection(provider: DatabaseProvider, connectionString: string): Promise<boolean> {
    try {
      return await validateConnection(provider, connectionString)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const metadata = PROVIDER_METADATA[provider]

      logger.errorWithSuggestions(`Connection validation failed for ${provider}`, [
        'Check that your database server is running',
        'Verify connection string format and credentials',
        'Ensure database exists and is accessible',
        metadata?.docs ? `See docs: ${metadata.docs}` : 'Check provider documentation',
      ])
      throw error
    }
  }

  /**
   * Extract missing package name from error message
   */
  private static extractMissingPackage(errorMessage: string): string {
    const packages = ['pg', 'mysql2', 'better-sqlite3', '@cloudflare/d1']

    for (const pkg of packages) {
      if (errorMessage.includes(pkg)) {
        return pkg
      }
    }

    // Try to extract from "Cannot find module 'package-name'"
    const match = errorMessage.match(/Cannot find module ['"]([^'"]+)['"]/)
    return match?.[1] || 'unknown package'
  }

  /**
   * Get appropriate install command for missing package
   */
  private static getInstallCommand(packageName: string): string {
    const installMap: Record<string, string> = {
      pg: 'npm install pg @types/pg',
      mysql2: 'npm install mysql2',
      'better-sqlite3': 'npm install better-sqlite3 @types/better-sqlite3',
      '@cloudflare/d1': 'npm install @cloudflare/d1',
    }

    return installMap[packageName] || `npm install ${packageName}`
  }
}

// Re-export CLI-specific functions with better error handling
export const cliLoadRefractConfig = ConfigErrorHandler.loadRefractConfig
export const cliCreateKyselyFromConfig = ConfigErrorHandler.createKyselyFromConfig
export const cliCreateKyselyFromUrl = ConfigErrorHandler.createKyselyFromUrl
export const cliCreateKyselyDialect = ConfigErrorHandler.createKyselyDialect
export const cliValidateConnection = ConfigErrorHandler.validateConnection
