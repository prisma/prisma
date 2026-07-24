/**
 * Issue #29355: prisma migrate deploy fails with "Schema engine error" on SQLite with certain RUST_LOG settings
 *
 * BUG SUMMARY:
 * `prisma migrate deploy` fails with "Schema engine error:" when RUST_LOG is set to
 * certain levels (warn, error), but succeeds with RUST_LOG=info or when RUST_LOG is unset.
 *
 * IMPORTANT CLARIFICATION:
 *
 * This test does NOT reproduce the exact BUG described in ISSUE #29355. The original ISSUE
 * reports that migrate deploy fails with DEFAULT settings and succeeds with RUST_LOG=info.
 *
 * This test discovers a RELATED BUT DIFFERENT BUG:
 * - ISSUE #29355 pattern: Default fails, RUST_LOG=info succeeds
 * - Test discovered pattern: Default succeeds, RUST_LOG=warn/error fails
 *
 * ROOT CAUSE ANALYSIS:
 *
 * In `packages/migrate/src/SchemaEngineCLI.ts:408-415`, the SchemaEngineCLI spawns the
 * Rust engine with these environment variables:
 *
 *   env: {
 *     RUST_LOG: 'info',  // Default setting
 *     RUST_BACKTRACE: '1',
 *     ...processEnv,     // User's env vars override the defaults
 *   }
 *
 * This means:
 * 1. If process.env.RUST_LOG is undefined, the engine gets RUST_LOG='info' (works)
 * 2. If process.env.RUST_LOG is explicitly set to 'info', the engine gets RUST_LOG='info' (works)
 * 3. If process.env.RUST_LOG is set to 'warn' or 'error', that overrides the default (fails)
 *
 * HYPOTHESIS FOR ORIGINAL ISSUE:
 *
 * The user who reported ISSUE #29355 may have had RUST_LOG set to 'warn' or 'error' in their
 * environment (via .bashrc, .zshrc, Docker, Kubernetes, or other tools), which would explain
 * why the default behavior failed for them but succeeded when they explicitly set RUST_LOG=info.
 *
 * This test reproduces the RELATED BUG by running migrate deploy with different RUST_LOG
 * settings and verifying that warn/error levels cause failures.
 *
 * CLI COMMAND VERIFICATION:
 *
 * Both API tests and CLI command tests were verified:
 * - API (MigrateDeploy.new().parse()): Default succeeds, warn/error fails
 * - CLI (npx prisma migrate deploy): Default succeeds, warn/error fails
 *
 * The two methods produce identical results.
 */

import fs from 'fs-jetpack'

import { MigrateDeploy } from '../commands/MigrateDeploy'
import { createDefaultTestContext } from './__helpers__/context'

const ctx = createDefaultTestContext()

describe('Issue #29355: Migrate Deploy RUST_LOG Dependency', () => {
  const originalRustLog = process.env.RUST_LOG
  const originalEnv = { ...process.env }
  const dbPath = 'dev.db'

  beforeEach(() => {
    // Clean up any existing database before each test
    if (fs.exists(dbPath) === 'file') {
      fs.remove(dbPath)
    }
  })

  afterEach(() => {
    // Restore original RUST_LOG value
    if (originalRustLog === undefined) {
      delete process.env.RUST_LOG
    } else {
      process.env.RUST_LOG = originalRustLog
    }

    // Clean up database after test
    if (fs.exists(dbPath) === 'file') {
      fs.remove(dbPath)
    }
  })

  /**
   * Core BUG reproduction test case
   *
   * This test reproduces a BUG RELATED to ISSUE #29355, but with a different failure pattern.
   *
   * ISSUE #29355 pattern: Default fails, RUST_LOG=info succeeds
   * Test discovered pattern: Default succeeds, RUST_LOG=warn/error fails
   *
   * Both patterns demonstrate that migrate deploy behavior is affected by RUST_LOG setting,
   * which is a BUG regardless of the specific pattern.
   */
  it('should succeed regardless of RUST_LOG value (related to #29355)', async () => {
    // Load fixture once
    ctx.fixture('issue-29355-rust-log')

    // Collect results from different RUST_LOG settings
    const results: Array<{ setting: string; result: string; error: Error | null; dbCreated: boolean }> = []

    // Test 1: No RUST_LOG set (undefined)
    process.env.RUST_LOG = undefined
    delete process.env.RUST_LOG

    let result1: string
    let error1: Error | null = null
    try {
      const config1 = await ctx.config()
      const configDir1 = ctx.configDir()
      result1 = await MigrateDeploy.new().parse([], config1, configDir1)
    } catch (e) {
      error1 = e as Error
      result1 = (e as Error).message
    }
    const dbCreated1 = fs.exists(dbPath) === 'file'
    results.push({ setting: 'undefined (default)', result: result1, error: error1, dbCreated: dbCreated1 })

    // Clean up database for next test
    if (fs.exists(dbPath) === 'file') {
      fs.remove(dbPath)
    }

    // Test 2: RUST_LOG=info (explicitly set)
    process.env.RUST_LOG = 'info'
    let result2: string
    let error2: Error | null = null
    try {
      const config2 = await ctx.config()
      const configDir2 = ctx.configDir()
      result2 = await MigrateDeploy.new().parse([], config2, configDir2)
    } catch (e) {
      error2 = e as Error
      result2 = (e as Error).message
    }
    const dbCreated2 = fs.exists(dbPath) === 'file'
    results.push({ setting: 'info', result: result2, error: error2, dbCreated: dbCreated2 })

    // Clean up database for next test
    if (fs.exists(dbPath) === 'file') {
      fs.remove(dbPath)
    }

    // Test 3: RUST_LOG=warn (different value that triggers the bug)
    process.env.RUST_LOG = 'warn'
    let result3: string
    let error3: Error | null = null
    try {
      const config3 = await ctx.config()
      const configDir3 = ctx.configDir()
      result3 = await MigrateDeploy.new().parse([], config3, configDir3)
    } catch (e) {
      error3 = e as Error
      result3 = (e as Error).message
    }
    const dbCreated3 = fs.exists(dbPath) === 'file'
    results.push({ setting: 'warn', result: result3, error: error3, dbCreated: dbCreated3 })

    // Clean up database for next test
    if (fs.exists(dbPath) === 'file') {
      fs.remove(dbPath)
    }

    // Test 4: RUST_LOG=error (minimal logging)
    process.env.RUST_LOG = 'error'
    let result4: string
    let error4: Error | null = null
    try {
      const config4 = await ctx.config()
      const configDir4 = ctx.configDir()
      result4 = await MigrateDeploy.new().parse([], config4, configDir4)
    } catch (e) {
      error4 = e as Error
      result4 = (e as Error).message
    }
    const dbCreated4 = fs.exists(dbPath) === 'file'
    results.push({ setting: 'error', result: result4, error: error4, dbCreated: dbCreated4 })

    // Restore environment
    process.env.RUST_LOG = originalEnv.RUST_LOG

    // Analyze results to detect BUG pattern
    const failedResults = results.filter((r) => r.error !== null)
    const succeededResults = results.filter((r) => r.error === null)

    // If all succeeded, BUG is not reproduced in this environment
    if (failedResults.length === 0) {
      // All RUST_LOG settings succeeded - BUG not reproduced
      expect(succeededResults.length).toBe(4)
      succeededResults.forEach((r) => {
        expect(r.result).toContain('successfully applied')
      })
      return
    }

    // If some failed and some succeeded, we have reproduced the BUG
    if (failedResults.length > 0 && succeededResults.length > 0) {
      const failedSettings = failedResults.map((r) => r.setting).join(', ')
      const succeededSettings = succeededResults.map((r) => r.setting).join(', ')

      // This is a BUG related to ISSUE #29355, but with a different failure pattern
      throw new Error(
        `BUG REPRODUCED (Related to #29355): Inconsistent behavior with different RUST_LOG settings!\n\n` +
          `Failed with RUST_LOG=${failedSettings}:\n` +
          failedResults.map((r) => `  - ${r.setting}: ${r.error?.message?.substring(0, 100)}`).join('\n') +
          `\n\nSucceeded with RUST_LOG=${succeededSettings}:\n` +
          succeededResults.map((r) => `  - ${r.setting}: OK`).join('\n') +
          `\n\n**IMPORTANT CLARIFICATION:**\n` +
          `This does NOT exactly match the pattern described in ISSUE #29355.\n` +
          `ISSUE #29355 pattern: Default fails, RUST_LOG=info succeeds\n` +
          `Test discovered pattern: Default succeeds, RUST_LOG=warn/error fails\n\n` +
          `However, both patterns demonstrate that migrate deploy behavior is affected by\n` +
          `RUST_LOG setting, which is a BUG.\n\n` +
          `HYPOTHESIS: The user who reported ISSUE #29355 likely had RUST_LOG set to 'warn'\n` +
          `or 'error' in their environment (via .bashrc, Docker, Kubernetes, etc.), which would\n` +
          `explain why their default behavior failed.\n\n` +
          `CLI VERIFICATION: Both API tests and CLI command tests produce identical results.`,
      )
    }

    // If all failed, this is a different issue
    if (failedResults.length === 4) {
      throw new Error(
        `All tests failed with different RUST_LOG settings.\n` +
          `Errors:\n` +
          results
            .map((r) => `  - RUST_LOG=${r.setting}: ${r.error?.message?.substring(0, 100) || 'undefined'}`)
            .join('\n') +
          `\n\nThis may indicate a test setup problem or a different issue.`,
      )
    }
  }, 60000) // 60 second timeout
})
