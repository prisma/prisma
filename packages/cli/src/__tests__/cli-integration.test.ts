import { spawn } from 'child_process'
import { existsSync, mkdirSync, readFileSync, rmSync } from 'fs'
import { resolve } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('CLI Integration Tests - Auto-Detection', () => {
  const testDir = resolve(__dirname, '../../test-temp-cli')
  const originalCwd = process.cwd()
  const cliPath = resolve(__dirname, '../../dist/bin.js')

  beforeEach(() => {
    // Create test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
    mkdirSync(testDir, { recursive: true })
    process.chdir(testDir)
  })

  afterEach(() => {
    // Cleanup
    process.chdir(originalCwd)
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true })
    }
  })

  const runCLI = (args: string[], input?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
    return new Promise((resolve) => {
      const child = spawn('node', [cliPath, ...args], {
        cwd: testDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      if (input) {
        child.stdin.write(input)
        child.stdin.end()
      }

      child.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
        })
      })
    })
  }

  describe('init command with --url flag', () => {
    it('should initialize with PostgreSQL URL auto-detection', async () => {
      const result = await runCLI(['init', '--url', 'postgresql://user:pass@localhost:5432/testdb'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('✓ Auto-detected provider: postgresql')

      const configContent = readFileSync('ork.config.ts', 'utf8')
      expect(configContent).toContain("provider: 'postgresql'")
    }, 10000)

    it('should initialize with MySQL URL auto-detection', async () => {
      const result = await runCLI(['init', '--url', 'mysql://user:pass@localhost:3306/testdb'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('✓ Auto-detected provider: mysql')

      const configContent = readFileSync('ork.config.ts', 'utf8')
      expect(configContent).toContain("provider: 'mysql'")
    }, 10000)

    it('should initialize with SQLite URL auto-detection', async () => {
      const result = await runCLI(['init', '--url', 'file:./dev.db'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('✓ Auto-detected provider: sqlite')

      const configContent = readFileSync('ork.config.ts', 'utf8')
      expect(configContent).toContain("provider: 'sqlite'")
    }, 10000)

    it('should initialize with D1 URL auto-detection', async () => {
      const result = await runCLI(['init', '--url', 'd1://my-database'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('✓ Auto-detected provider: d1')

      const configContent = readFileSync('ork.config.ts', 'utf8')
      expect(configContent).toContain("provider: 'd1'")
    }, 10000)
  })

  describe('init command with --provider flag', () => {
    it('should initialize with provider only and empty URL', async () => {
      const result = await runCLI(['init', '--provider', 'sqlite', '--skip-schema'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('✓ Selected provider: sqlite')
      expect(existsSync('ork.config.ts')).toBe(true)

      const configContent = readFileSync('ork.config.ts', 'utf8')
      expect(configContent).toContain("provider: 'sqlite'")
      expect(configContent).toContain("url: ''")
    }, 10000)
  })

  describe('init command error handling', () => {
    it('should fail with invalid URL format', async () => {
      const result = await runCLI(['init', '--url', 'invalid://test'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Unable to detect provider from URL')
      expect(result.stderr).toContain('Supported formats: postgresql://, mysql://, file:, d1://')
    }, 10000)

    it('should fail with unsupported protocol', async () => {
      const result = await runCLI(['init', '--url', 'mongodb://localhost:27017/db'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Unable to detect provider from URL')
    }, 10000)

    it('should fail when config already exists without --force', async () => {
      // First initialization
      await runCLI(['init', '--url', 'postgresql://user:pass@localhost:5432/db'])

      // Second initialization should fail
      const result = await runCLI(['init', '--url', 'mysql://user:pass@localhost:3306/db'])

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('already exists')
    }, 10000)

    it('should succeed when config exists with --force', async () => {
      // First initialization
      await runCLI(['init', '--url', 'postgresql://user:pass@localhost:5432/db'])

      // Second initialization with force should succeed
      const result = await runCLI(['init', '--url', 'mysql://user:pass@localhost:3306/db', '--force'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('✓ Auto-detected provider: mysql')

      const configContent = readFileSync('ork.config.ts', 'utf8')
      expect(configContent).toContain("provider: 'mysql'")
    }, 10000)
  })

  describe('init command interactive mode', () => {
    it('should prompt for URL and auto-detect provider', async () => {
      // Interactive testing with prompts is complex due to TTY requirements
      // We'll test that the command starts correctly and shows the right prompt

      const runCLIWithTimeout = (
        args: string[],
        input?: string,
        timeoutMs = 2000,
      ): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
        return new Promise((resolve) => {
          const child = spawn('node', [cliPath, ...args], {
            cwd: testDir,
            stdio: ['pipe', 'pipe', 'pipe'],
          })

          let stdout = ''
          let stderr = ''

          child.stdout.on('data', (data) => {
            stdout += data.toString()
          })

          child.stderr.on('data', (data) => {
            stderr += data.toString()
          })

          if (input) {
            child.stdin.write(input)
            child.stdin.end()
          }

          // Kill the process after timeout
          const timeout = setTimeout(() => {
            child.kill('SIGTERM')
            resolve({
              stdout,
              stderr,
              exitCode: -1, // Indicate timeout
            })
          }, timeoutMs)

          child.on('close', (code) => {
            clearTimeout(timeout)
            resolve({
              stdout,
              stderr,
              exitCode: code || 0,
            })
          })
        })
      }

      const result = await runCLIWithTimeout(['init'], '')

      // The command should start and show the prompt, even if it times out
      expect(result.stdout).toContain('Database connection URL (optional)')
      expect(result.stdout).toContain('Initializing Ork project')

      // This validates that the interactive flow is set up correctly
      // The actual interactive functionality is tested manually and through --url flag tests
    }, 5000)
  })

  describe('skip options', () => {
    it('should skip schema file creation with --skip-schema', async () => {
      const result = await runCLI(['init', '--url', 'postgresql://user:pass@localhost:5432/db', '--skip-schema'])

      expect(result.exitCode).toBe(0)
      expect(existsSync('ork.config.ts')).toBe(true)
      expect(existsSync('schema.prisma')).toBe(false)
    }, 10000)
  })

  describe('provider-specific features', () => {
    it('should include D1-specific instructions in output', async () => {
      const result = await runCLI(['init', '--url', 'd1://my-database'])

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('For Cloudflare D1')
      expect(result.stdout).toContain('wrangler d1 execute')
    }, 10000)
  })

  describe('help and usage', () => {
    it('should show help with auto-detection description', async () => {
      const result = await runCLI(['init', '--help'])

      // Commander.js exits with code 0 when displaying help
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('Initialize a new Ork project')
      expect(result.stdout).toContain('--url <url>')
      expect(result.stdout).toContain('Database connection URL')
      expect(result.stdout).toContain('auto-detected')
      expect(result.stdout).toContain('--provider')
    }, 10000)
  })
})
