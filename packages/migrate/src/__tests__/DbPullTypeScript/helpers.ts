import { DbPull } from '../../commands/DbPull'
import { DbPullTypeScript } from '../../commands/DbPullTypeScript'
import { createDefaultTestContext } from '../__helpers__/context'

type TestContext = ReturnType<typeof createDefaultTestContext>

/**
 * Helper utilities for testing DbPullTypeScript command parity with DbPull.
 */

/**
 * Captures output from a command execution and clears the context.
 */
export function captureOutput(ctx: TestContext) {
  const output = ctx.normalizedCapturedStdout()
  const errors = ctx.mocked['console.error'].mock.calls.join('\n')
  ctx.clearCapturedStdout()
  ctx.mocked['console.error'].mockClear()
  return { output, errors }
}

/**
 * Compares outputs from DbPull and DbPullTypeScript commands to ensure parity.
 *
 * @param ctx - Test context
 * @param args - Command arguments to test
 * @param expectError - Whether to expect the command to throw an error
 */
export async function compareCommandOutputs(
  ctx: TestContext,
  args: string[],
  expectError = false,
): Promise<{ originalOutput: string; tsOutput: string; match: boolean }> {
  let originalOutput = ''
  let originalErrors = ''
  let tsOutput = ''
  let tsErrors = ''

  // Test original pull command
  const pullOriginal = new DbPull()
  const config = await ctx.config()

  if (expectError) {
    await expect(pullOriginal.parse(args, config)).rejects.toThrow()
  } else {
    await expect(pullOriginal.parse(args, config)).resolves.toBeDefined()
  }

  const originalResult = captureOutput(ctx)
  originalOutput = originalResult.output
  originalErrors = originalResult.errors

  // Test TypeScript pull-ts command
  const pullTs = new DbPullTypeScript()

  if (expectError) {
    await expect(pullTs.parse(args, config)).rejects.toThrow()
  } else {
    await expect(pullTs.parse(args, config)).resolves.toBeDefined()
  }

  const tsResult = captureOutput(ctx)
  tsOutput = tsResult.output
  tsErrors = tsResult.errors

  // Normalize outputs for comparison (remove TypeScript-native indicators)
  const normalizedTsOutput = tsOutput.replace(/\(TypeScript-native\)/g, '').trim()
  const normalizedOriginalOutput = originalOutput.trim()

  const outputsMatch = normalizedTsOutput === normalizedOriginalOutput
  const errorsMatch = tsErrors === originalErrors

  return {
    originalOutput,
    tsOutput,
    match: outputsMatch && errorsMatch,
  }
}

/**
 * Verifies that DbPullTypeScript produces identical schema output to DbPull.
 *
 * @param ctx - Test context
 * @param args - Command arguments
 * @param fixture - Test fixture to use
 */
export async function verifySchemaOutputParity(ctx: TestContext, args: string[], fixture: string): Promise<void> {
  ctx.fixture(fixture)

  const comparison = await compareCommandOutputs(ctx, args)

  expect(comparison.match).toBe(true)
  expect(comparison.tsOutput).toContain('datasource db')
  expect(comparison.originalOutput).toContain('datasource db')
}

/**
 * Creates a minimal config for testing programmatic usage.
 */
export async function createTestConfig(ctx: TestContext, withAdapter = true) {
  const config = await ctx.config()

  if (!withAdapter) {
    config.migrate = undefined
  }

  return config
}

/**
 * Strips TypeScript-native indicators from output for clean comparison.
 */
export function normalizeOutput(output: string): string {
  return output
    .replace(/\(TypeScript-native\)/g, '')
    .replace(/prisma db pull-ts/g, 'prisma db pull')
    .trim()
}
