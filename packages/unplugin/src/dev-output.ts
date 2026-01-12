/**
 * Enhanced development output system for Next.js-like developer experience
 */

import pc from 'picocolors'

export interface DevOutputOptions {
  debug: boolean
  silent?: boolean
  prefix?: string
  preserveLogs?: boolean
}

export class DevOutput {
  private options: DevOutputOptions
  private startTime: number = 0
  private isRegenerating: boolean = false

  constructor(options: DevOutputOptions) {
    this.options = {
      prefix: 'ork',
      ...options,
    }
  }

  /**
   * Start regeneration process with progress indicator
   */
  startRegeneration(reason: string = 'Schema changed'): void {
    if (this.options.silent) return

    this.startTime = Date.now()
    this.isRegenerating = true

    // Clear previous output for clean experience
    if (!this.options.debug && !this.options.preserveLogs) {
      console.clear()
    }

    this.log('info', `${reason}, regenerating types...`, '🔄')
  }

  /**
   * Complete regeneration with success message
   */
  completeRegeneration(modelCount: number, moduleCount: number): void {
    if (this.options.silent) return

    const duration = Date.now() - this.startTime
    this.isRegenerating = false

    this.log(
      'success',
      `Generated types for ${pc.bold(String(modelCount))} models in ${pc.bold(String(moduleCount))} modules ${pc.dim(
        `(${duration}ms)`,
      )}`,
      '✅',
    )

    if (this.options.debug) {
      this.log('debug', `Virtual modules updated: types, index, generated`)
    }
  }

  /**
   * Show schema parsing error with context and suggestions
   */
  showSchemaError(errors: Array<{ message: string; line?: number; column?: number }>): void {
    if (this.options.silent) return

    this.isRegenerating = false

    this.log('error', 'Schema parsing failed:', '❌')
    console.log() // Empty line for spacing

    errors.forEach((error, index) => {
      const errorNum = errors.length > 1 ? `${index + 1}. ` : ''
      console.log(`  ${pc.red('○')} ${errorNum}${error.message}`)

      if (error.line !== undefined) {
        console.log(`    ${pc.dim(`at line ${error.line}${error.column ? `, column ${error.column}` : ''}`)}`)
      }
    })

    console.log() // Empty line
    this.showErrorSuggestions(errors)
  }

  /**
   * Show file system error (schema not found, etc.)
   */
  showFileError(schemaPath: string, error: string): void {
    if (this.options.silent) return

    this.log('error', `Schema file error: ${error}`, '📁')
    console.log(`  ${pc.dim('Path:')} ${schemaPath}`)
    console.log()
    console.log(`  ${pc.yellow('💡 Tip:')} Make sure your schema.prisma file exists and is readable`)
  }

  /**
   * Show general information
   */
  info(message: string): void {
    if (this.options.silent) return
    this.log('info', message, 'ℹ️')
  }

  /**
   * Show debug information (only when debug enabled)
   */
  debug(message: string): void {
    if (this.options.debug && !this.options.silent) {
      this.log('debug', message)
    }
  }

  /**
   * Show warning
   */
  warn(message: string): void {
    if (this.options.silent) return
    this.log('warn', message, '⚠️')
  }

  /**
   * Core logging function with consistent formatting
   */
  private log(level: 'info' | 'success' | 'error' | 'warn' | 'debug', message: string, icon?: string): void {
    const timestamp = new Date().toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

    const prefix = pc.dim(`[${timestamp}]`) + ' ' + pc.cyan(`${this.options.prefix}:`)
    const iconStr = icon ? `${icon} ` : ''

    let styledMessage: string
    switch (level) {
      case 'success':
        styledMessage = pc.green(message)
        break
      case 'error':
        styledMessage = pc.red(message)
        break
      case 'warn':
        styledMessage = pc.yellow(message)
        break
      case 'debug':
        styledMessage = pc.dim(message)
        break
      default:
        styledMessage = message
    }

    console.log(`${prefix} ${iconStr}${styledMessage}`)
  }

  /**
   * Show helpful suggestions based on common schema errors
   */
  private showErrorSuggestions(errors: Array<{ message: string }>): void {
    const suggestions: string[] = []

    // Analyze errors and provide contextual suggestions
    const errorMessages = errors.map((e) => e.message.toLowerCase())

    if (errorMessages.some((msg) => msg.includes('unexpected') || msg.includes('syntax'))) {
      suggestions.push('Check your schema syntax - common issues include missing quotes, semicolons, or brackets')
    }

    if (errorMessages.some((msg) => msg.includes('model') || msg.includes('field'))) {
      suggestions.push('Verify your model and field definitions follow Prisma schema syntax')
    }

    if (errorMessages.some((msg) => msg.includes('relation'))) {
      suggestions.push('Review your relation definitions - ensure @relation attributes are correct')
    }

    if (errorMessages.some((msg) => msg.includes('generator') || msg.includes('datasource'))) {
      suggestions.push('Check your generator and datasource blocks have the required fields')
    }

    // Default suggestion if no specific matches
    if (suggestions.length === 0) {
      suggestions.push('Review the Prisma schema documentation: https://pris.ly/d/prisma-schema')
    }

    suggestions.forEach((suggestion) => {
      console.log(`  ${pc.yellow('💡')} ${suggestion}`)
    })

    console.log()
    console.log(`  ${pc.dim('Watching for changes...')}`)
  }

  /**
   * Show startup message
   */
  showStartup(schemaPath: string): void {
    if (this.options.silent) return

    if (!this.options.debug && !this.options.preserveLogs) {
      console.clear()
    }

    this.log('info', 'Starting Ork development experience', '🚀')
    console.log(`  ${pc.dim('Schema:')} ${schemaPath}`)
    console.log(`  ${pc.dim('Mode:')} ${this.options.debug ? 'debug' : 'development'}`)
    console.log()
  }

  /**
   * Show file watching status
   */
  showWatching(schemaPath: string): void {
    if (this.options.silent) return

    this.log('info', `Watching ${pc.dim(schemaPath)} for changes...`, '👁️')
  }
}
