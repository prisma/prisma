import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@prisma/internals', () => ({
  isCurrentBinInstalledGlobally: vi.fn(() => false),
}))

let internals: typeof import('@prisma/internals')

beforeEach(async () => {
  internals = await import('@prisma/internals')
})

describe('findLocalPrismaInstallation', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('returns undefined when no local installation exists', async () => {
    const { findLocalPrismaInstallation } = await import('../warn-local-installation')
    expect(findLocalPrismaInstallation(tmpDir)).toBeUndefined()
  })

  it('returns path when node_modules/.bin/prisma exists', async () => {
    const binDir = path.join(tmpDir, 'node_modules', '.bin')
    fs.mkdirSync(binDir, { recursive: true })
    fs.writeFileSync(path.join(binDir, 'prisma'), '', { mode: 0o755 })

    const { findLocalPrismaInstallation } = await import('../warn-local-installation')
    const result = findLocalPrismaInstallation(tmpDir)
    expect(result).toBe(path.join(tmpDir, 'node_modules', '.bin', 'prisma'))
  })

  it('returns path when Windows shim node_modules/.bin/prisma.cmd exists', async () => {
    const binDir = path.join(tmpDir, 'node_modules', '.bin')
    fs.mkdirSync(binDir, { recursive: true })
    fs.writeFileSync(path.join(binDir, 'prisma.cmd'), '')

    const { findLocalPrismaInstallation } = await import('../warn-local-installation')
    const result = findLocalPrismaInstallation(tmpDir)
    expect(result).toBe(path.join(tmpDir, 'node_modules', '.bin', 'prisma.cmd'))
  })

  it('returns path when node_modules/prisma directory exists', async () => {
    const prismaDir = path.join(tmpDir, 'node_modules', 'prisma')
    fs.mkdirSync(prismaDir, { recursive: true })

    const { findLocalPrismaInstallation } = await import('../warn-local-installation')
    const result = findLocalPrismaInstallation(tmpDir)
    expect(result).toBe(prismaDir)
  })
})

describe('warnIfLocalInstallationShadowed', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it('does not warn when running locally (not globally installed)', async () => {
    vi.mocked(internals.isCurrentBinInstalledGlobally).mockReturnValue(false)

    const { warnIfLocalInstallationShadowed } = await import('../warn-local-installation')
    warnIfLocalInstallationShadowed()

    expect(consoleWarnSpy).not.toHaveBeenCalled()
  })

  it('does not warn when globally installed but no local installation exists', async () => {
    vi.mocked(internals.isCurrentBinInstalledGlobally).mockReturnValue('npm')

    // Use a temporary directory that has no node_modules
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-test-'))
    const originalCwd = process.cwd()
    process.chdir(tmpDir)

    try {
      const { warnIfLocalInstallationShadowed } = await import('../warn-local-installation')
      warnIfLocalInstallationShadowed()
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    } finally {
      process.chdir(originalCwd)
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })

  it('warns when globally installed and a local installation exists', async () => {
    vi.mocked(internals.isCurrentBinInstalledGlobally).mockReturnValue('npm')

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-test-'))
    const binDir = path.join(tmpDir, 'node_modules', '.bin')
    fs.mkdirSync(binDir, { recursive: true })
    fs.writeFileSync(path.join(binDir, 'prisma'), '', { mode: 0o755 })

    const originalCwd = process.cwd()
    process.chdir(tmpDir)

    try {
      const { warnIfLocalInstallationShadowed } = await import('../warn-local-installation')
      warnIfLocalInstallationShadowed()

      expect(consoleWarnSpy).toHaveBeenCalledOnce()
      const message = consoleWarnSpy.mock.calls[0][0] as string
      expect(message).toContain('global Prisma CLI')
      expect(message).toContain('npx prisma')
      expect(message).toContain('npm')
    } finally {
      process.chdir(originalCwd)
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
