import {
  formatVersionMismatchWarning,
  getVersionMismatchWarning,
  normalizeVersion,
} from '../utils/version-mismatch-warning'

describe('version mismatch warning', () => {
  it('does not warn when Prisma is not running from a global install', async () => {
    await expect(
      getVersionMismatchWarning({
        globalVersion: '6.0.0',
        isGlobalInstall: () => false,
      }),
    ).resolves.toBeNull()
  })

  it('warns when global Prisma and local @prisma/client do not match', async () => {
    await expect(
      getVersionMismatchWarning({
        cwd: process.cwd(),
        globalVersion: '6.0.0',
        isGlobalInstall: () => 'npm',
        getPrismaClientVersion: () => Promise.resolve('5.0.0'),
        getPackageJsonVersion: () => Promise.resolve(null),
      }),
    ).resolves.toContain('@prisma/client@5.0.0')
  })

  it('warns when global Prisma and local prisma do not match', async () => {
    await expect(
      getVersionMismatchWarning({
        cwd: process.cwd(),
        globalVersion: '6.0.0',
        isGlobalInstall: () => 'npm',
        getPrismaClientVersion: () => Promise.resolve(null),
        getPackageJsonVersion: () => Promise.resolve('5.0.0'),
      }),
    ).resolves.toContain('prisma@5.0.0')
  })

  it('shows both mismatched local packages when both are out of sync', async () => {
    const result = await getVersionMismatchWarning({
      cwd: process.cwd(),
      globalVersion: '6.0.0',
      isGlobalInstall: () => 'npm',
      getPrismaClientVersion: () => Promise.resolve('5.1.0'),
      getPackageJsonVersion: () => Promise.resolve('5.0.0'),
    })

    expect(result).toContain('prisma@5.0.0')
    expect(result).toContain('@prisma/client@5.1.0')
  })

  it('uses project package manager in the suggested command', async () => {
    const result = await getVersionMismatchWarning({
      cwd: process.cwd(),
      globalVersion: '6.0.0',
      isGlobalInstall: () => 'npm',
      getPrismaClientVersion: () => Promise.resolve('5.0.0'),
      getPackageJsonVersion: () => Promise.resolve(null),
      detectPackageManager: () => 'pnpm',
    })

    expect(result).toContain('pnpm prisma generate')
  })

  it('does not warn for matching versions', async () => {
    await expect(
      getVersionMismatchWarning({
        cwd: process.cwd(),
        globalVersion: '6.0.0',
        isGlobalInstall: () => 'npm',
        getPrismaClientVersion: () => Promise.resolve('6.0.0'),
        getPackageJsonVersion: () => Promise.resolve('^6.0.0'),
      }),
    ).resolves.toBeNull()
  })

  it('skips package specifiers that cannot be safely compared', async () => {
    await expect(
      getVersionMismatchWarning({
        cwd: process.cwd(),
        globalVersion: '6.0.0',
        isGlobalInstall: () => 'npm',
        getPrismaClientVersion: () => Promise.resolve('workspace:*'),
        getPackageJsonVersion: () => Promise.resolve('latest'),
      }),
    ).resolves.toBeNull()
  })

  it('normalizes exact, caret, tilde, and prerelease versions', () => {
    expect(normalizeVersion('6.0.0')).toBe('6.0.0')
    expect(normalizeVersion('^6.0.0')).toBe('6.0.0')
    expect(normalizeVersion('~6.0.0')).toBe('6.0.0')
    expect(normalizeVersion('6.0.0-dev.1')).toBe('6.0.0-dev.1')
  })

  it('formats a clear warning', () => {
    expect(
      formatVersionMismatchWarning({
        packageName: '@prisma/client',
        globalVersion: '6.0.0',
        localVersion: '5.0.0',
      }),
    ).toContain('npx prisma generate')
  })
})
