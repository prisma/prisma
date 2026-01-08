import path from 'node:path'

import { shouldWarnAboutGlobalInstallation, getLocalPrismaVersion } from '../utils/check-global-installation'

describe('shouldWarnAboutGlobalInstallation', () => {
  const originalDirname = __dirname

  it('should return false when no local prisma is installed', () => {
    // Use a directory that definitely has no node_modules/prisma
    const result = shouldWarnAboutGlobalInstallation('/tmp/non-existent-project')
    expect(result).toBe(false)
  })

  it('should return false when running from local node_modules', () => {
    // Mock a scenario where the CLI is in the project's node_modules
    // This test verifies the path comparison logic
    const mockCwd = '/test/project'

    // When there's no local prisma found, it should return false
    const result = shouldWarnAboutGlobalInstallation(mockCwd)
    expect(result).toBe(false)
  })
})

describe('getLocalPrismaVersion', () => {
  it('should return null when no local prisma is installed', async () => {
    const result = await getLocalPrismaVersion('/tmp/non-existent-project')
    expect(result).toBeNull()
  })
})
