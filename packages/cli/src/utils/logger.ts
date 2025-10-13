import chalk from 'chalk'

import type { Logger } from '../types.js'

/**
 * Enhanced logger with colored output for better developer experience
 */
export class RefractLogger implements Logger {
  private prefix = chalk.blue.bold('refract')

  info(message: string): void {
    console.log(`${this.prefix} ${chalk.blue('ℹ')} ${message}`)
  }

  success(message: string): void {
    console.log(`${this.prefix} ${chalk.green('✓')} ${message}`)
  }

  warn(message: string): void {
    console.log(`${this.prefix} ${chalk.yellow('⚠')} ${chalk.yellow(message)}`)
  }

  error(message: string): void {
    console.error(`${this.prefix} ${chalk.red('✗')} ${chalk.red(message)}`)
  }

  debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(`${this.prefix} ${chalk.gray('🐛')} ${chalk.gray(message)}`)
    }
  }

  /**
   * Display a spinner with message
   */
  spinner(message: string) {
    const ora = require('ora')
    return ora({
      text: message,
      prefixText: this.prefix,
      color: 'blue',
    })
  }

  /**
   * Display command help with proper formatting
   */
  help(
    command: string,
    description: string,
    usage: string,
    options: Array<{ flag: string; description: string }> = [],
  ) {
    console.log()
    console.log(chalk.blue.bold(`refract ${command}`))
    console.log()
    console.log(chalk.gray(description))
    console.log()
    console.log(chalk.yellow('Usage:'))
    console.log(`  ${chalk.cyan(usage)}`)

    if (options.length > 0) {
      console.log()
      console.log(chalk.yellow('Options:'))
      options.forEach(({ flag, description }) => {
        console.log(`  ${chalk.cyan(flag.padEnd(20))} ${description}`)
      })
    }
    console.log()
  }

  /**
   * Display error with context and suggestions
   */
  errorWithSuggestions(error: string, suggestions: string[] = []) {
    this.error(error)

    if (suggestions.length > 0) {
      console.log()
      console.log(chalk.yellow('Suggestions:'))
      suggestions.forEach((suggestion) => {
        console.log(`  ${chalk.gray('•')} ${suggestion}`)
      })
    }
    console.log()
  }

  /**
   * Display configuration summary
   */
  configSummary(config: Record<string, any>) {
    console.log()
    console.log(chalk.blue.bold('Configuration:'))
    Object.entries(config).forEach(([key, value]) => {
      const formattedValue =
        typeof value === 'object'
          ? JSON.stringify(value, null, 2)
              .split('\n')
              .map((line) => `    ${line}`)
              .join('\n')
          : String(value)
      console.log(`  ${chalk.cyan(key)}: ${chalk.gray(formattedValue)}`)
    })
    console.log()
  }
}

// Export singleton instance
export const logger = new RefractLogger()
