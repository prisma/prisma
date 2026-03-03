import { jestConsoleContext, jestContext } from '@prisma/get-platform'

import { Generate } from '../../Generate'
import {
  checkVersionMismatch,
  formatVersionMismatchWarning,
  type VersionMismatchOptions,
} from '../../utils/versionMismatchChecker'
import { configContextContributor } from '../_utils/config-context'

const ctx = jestContext.new().add(jestConsoleContext()).add(configContextContributor()).assemble()

describe('versionMismatchChecker', () => {
  describe('checkVersionMismatch', () => {
    it('should return null when prisma is not installed globally', async () => {
      const options: VersionMismatchOptions = {
        isGlobalInstall: () => false,
        getClientVersion: () => Promise.resolve('1.0.0'),
        getLocalPrismaVersion: () => Promise.resolve('2.0.0'),
      }

      const result = await checkVersionMismatch('3.0.0', options)
      expect(result).toBeNull()
    })

    it('should return null when versions match', async () => {
      const options: VersionMismatchOptions = {
        isGlobalInstall: () => 'npm',
        getClientVersion: () => Promise.resolve('3.0.0'),
        getLocalPrismaVersion: () => Promise.resolve('3.0.0'),
      }

      const result = await checkVersionMismatch('3.0.0', options)
      expect(result).toBeNull()
    })

    it('should detect @prisma/client version mismatch', async () => {
      const options: VersionMismatchOptions = {
        isGlobalInstall: () => 'npm',
        getClientVersion: () => Promise.resolve('2.0.0'),
        getLocalPrismaVersion: () => Promise.resolve(null),
      }

      const result = await checkVersionMismatch('3.0.0', options)
      expect(result).not.toBeNull()
      expect(result?.hasMismatch).toBe(true)
      expect(result?.globalVersion).toBe('3.0.0')
      expect(result?.localPackageType).toBe('@prisma/client')
      expect(result?.localVersion).toBe('2.0.0')
    })

    it('should detect local prisma version mismatch', async () => {
      const options: VersionMismatchOptions = {
        isGlobalInstall: () => 'npm',
        getClientVersion: () => Promise.resolve(null),
        getLocalPrismaVersion: () => Promise.resolve('1.0.0'),
      }

      const result = await checkVersionMismatch('3.0.0', options)
      expect(result).not.toBeNull()
      expect(result?.hasMismatch).toBe(true)
      expect(result?.globalVersion).toBe('3.0.0')
      expect(result?.localPackageType).toBe('prisma')
      expect(result?.localVersion).toBe('1.0.0')
    })

    it('should prioritize @prisma/client version mismatch over prisma version mismatch', async () => {
      const options: VersionMismatchOptions = {
        isGlobalInstall: () => 'npm',
        getClientVersion: () => Promise.resolve('2.0.0'),
        getLocalPrismaVersion: () => Promise.resolve('1.0.0'),
      }

      const result = await checkVersionMismatch('3.0.0', options)
      expect(result).not.toBeNull()
      expect(result?.localPackageType).toBe('@prisma/client')
    })

    it('should return null when no local packages found', async () => {
      const options: VersionMismatchOptions = {
        isGlobalInstall: () => 'npm',
        getClientVersion: () => Promise.resolve(null),
        getLocalPrismaVersion: () => Promise.resolve(null),
      }

      const result = await checkVersionMismatch('3.0.0', options)
      expect(result).toBeNull()
    })
  })

  describe('formatVersionMismatchWarning', () => {
    it('should format warning message correctly', () => {
      const result = {
        hasMismatch: true,
        globalVersion: '3.0.0',
        localPackageType: '@prisma/client' as const,
        localVersion: '2.0.0',
      }

      const warning = formatVersionMismatchWarning(result)
      expect(warning).toContain('warn')
      expect(warning).toContain('prisma@3.0.0')
      expect(warning).toContain('@prisma/client@2.0.0')
      expect(warning).toContain("don't match")
    })
  })
})

describe('Generate with version mismatch', () => {
  it('should show warning when global prisma and local @prisma/client versions mismatch', async () => {
    ctx.fixture('example-project')

    const mockOptions: VersionMismatchOptions = {
      isGlobalInstall: () => 'npm',
      getClientVersion: () => Promise.resolve('2.0.0'),
      getLocalPrismaVersion: () => Promise.resolve(null),
    }

    const generate = new Generate(async () => {}, mockOptions)
    const result = await generate.parse([], await ctx.config())

    // The result should contain the warning
    expect(result).toContain('warn')
    expect(result).toContain('Global prisma@0.0.0')
    expect(result).toContain('@prisma/client@2.0.0')
    expect(result).toContain("don't match")
  })

  it('should show warning when global prisma and local prisma versions mismatch', async () => {
    ctx.fixture('example-project')

    const mockOptions: VersionMismatchOptions = {
      isGlobalInstall: () => 'npm',
      getClientVersion: () => Promise.resolve(null),
      getLocalPrismaVersion: () => Promise.resolve('1.0.0'),
    }

    const generate = new Generate(async () => {}, mockOptions)
    const result = await generate.parse([], await ctx.config())

    expect(result).toContain('warn')
    expect(result).toContain('Global prisma@0.0.0')
    expect(result).toContain('prisma@1.0.0')
    expect(result).toContain("don't match")
  })

  it('should not show warning when not installed globally', async () => {
    ctx.fixture('example-project')

    const mockOptions: VersionMismatchOptions = {
      isGlobalInstall: () => false,
      getClientVersion: () => Promise.resolve('2.0.0'),
      getLocalPrismaVersion: () => Promise.resolve('1.0.0'),
    }

    const generate = new Generate(async () => {}, mockOptions)
    const result = await generate.parse([], await ctx.config())

    // Should not contain version mismatch warning
    expect(result).not.toContain("don't match")
  })

  it('should not show warning when versions match', async () => {
    ctx.fixture('example-project')

    const mockOptions: VersionMismatchOptions = {
      isGlobalInstall: () => 'npm',
      getClientVersion: () => Promise.resolve('0.0.0'), // Same as pkg.version in tests
      getLocalPrismaVersion: () => Promise.resolve('0.0.0'),
    }

    const generate = new Generate(async () => {}, mockOptions)
    const result = await generate.parse([], await ctx.config())

    // Should not contain version mismatch warning for matching versions
    expect(result).not.toContain("don't match")
  })
})
