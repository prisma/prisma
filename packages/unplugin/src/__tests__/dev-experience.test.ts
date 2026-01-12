import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DevOutput } from '../dev-output.js'

describe('Enhanced Development Experience', () => {
  let consoleOutput: string[] = []
  const originalLog = console.log
  const originalClear = console.clear

  beforeEach(() => {
    consoleOutput = []

    // Mock console to capture output
    console.log = vi.fn((...args) => {
      consoleOutput.push(args.join(' '))
    })
    console.clear = vi.fn()
  })

  afterAll(() => {
    console.log = originalLog
    console.clear = originalClear
  })

  it('should show enhanced startup message', () => {
    const devOutput = new DevOutput({ debug: false })

    devOutput.showStartup('/test/schema.prisma')

    // Check that startup message appears
    const startupMessage = consoleOutput.find((line) => line.includes('🚀 Starting Ork development experience'))
    expect(startupMessage).toBeDefined()

    // Check that schema path is shown
    const schemaPath = consoleOutput.find((line) => line.includes('Schema: /test/schema.prisma'))
    expect(schemaPath).toBeDefined()
  })

  it('should show enhanced error messages with context', () => {
    const devOutput = new DevOutput({ debug: false })

    devOutput.showSchemaError([
      {
        message: 'Unexpected token "invalid"',
        line: 1,
        column: 5,
      },
    ])

    // Check that error message appears
    const errorMessage = consoleOutput.find((line) => line.includes('❌ Schema parsing failed'))
    expect(errorMessage).toBeDefined()

    // Check that line number is shown
    const lineInfo = consoleOutput.find((line) => line.includes('at line 1, column 5'))
    expect(lineInfo).toBeDefined()

    // Check that suggestion is provided
    const suggestion = consoleOutput.find((line) => line.includes('💡'))
    expect(suggestion).toBeDefined()
  })

  it('should show success message with model count', () => {
    const devOutput = new DevOutput({ debug: false })

    devOutput.startRegeneration('Schema changed')
    devOutput.completeRegeneration(2, 3)

    // Check that regeneration start message appears
    const startMessage = consoleOutput.find((line) => line.includes('🔄 Schema changed, regenerating types'))
    expect(startMessage).toBeDefined()

    // Check that success message shows correct counts
    const successMessage = consoleOutput.find((line) => line.includes('✅ Generated types for 2 models in 3 modules'))
    expect(successMessage).toBeDefined()
  })

  it('should handle file errors gracefully', () => {
    const devOutput = new DevOutput({ debug: false })

    devOutput.showFileError('/test/missing.prisma', 'File not found')

    // Check that file error message appears
    const fileError = consoleOutput.find((line) => line.includes('📁 Schema file error: File not found'))
    expect(fileError).toBeDefined()

    // Check that helpful tip is provided
    const tip = consoleOutput.find((line) => line.includes('💡 Tip: Make sure your schema.prisma file exists'))
    expect(tip).toBeDefined()
  })

  it('should respect silent mode', () => {
    const devOutput = new DevOutput({ debug: false, silent: true })

    devOutput.showStartup('/test/schema.prisma')
    devOutput.info('Test message')
    devOutput.warn('Test warning')

    // Should not produce any output in silent mode
    expect(consoleOutput).toHaveLength(0)
  })

  it('should show debug messages only when debug enabled', () => {
    const devOutput = new DevOutput({ debug: true })

    devOutput.debug('Debug message')

    const debugMessage = consoleOutput.find((line) => line.includes('Debug message'))
    expect(debugMessage).toBeDefined()
  })

  it('should not show debug messages when debug disabled', () => {
    const devOutput = new DevOutput({ debug: false })

    devOutput.debug('Debug message')

    const debugMessage = consoleOutput.find((line) => line.includes('Debug message'))
    expect(debugMessage).toBeUndefined()
  })

  it('should provide contextual error suggestions', () => {
    const devOutput = new DevOutput({ debug: false })

    // Test syntax error suggestions
    devOutput.showSchemaError([
      {
        message: 'Unexpected syntax error',
      },
    ])

    const syntaxSuggestion = consoleOutput.find((line) => line.includes('Check your schema syntax'))
    expect(syntaxSuggestion).toBeDefined()
  })
})
