import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { shouldWarnAboutGlobalInstallation, getLocalPrismaVersion } from '../utils/check-global-installation'

describe('shouldWarnAboutGlobalInstallation', () => {
  it('should return false when no local prisma is installed', () => {
    // Use a directory that definitely has no node_modules/prisma
    const result = shouldWarnAboutGlobalInstallation('/tmp/non-existent-project')
    expect(result).toBe(false)
  })

  it('should return false for non-existent project directory', () => {
    const result = shouldWarnAboutGlobalInstallation('/path/that/does/not/exist')
    expect(result).toBe(false)
  })
})

describe('getLocalPrismaVersion', () => {
  it('should return null when no local prisma is installed', async () => {
    const result = await getLocalPrismaVersion('/tmp/non-existent-project')
    expect(result).toBeNull()
  })

  it('should return null for non-existent project directory', async () => {
    const result = await getLocalPrismaVersion('/path/that/does/not/exist')
    expect(result).toBeNull()
  })
})

describe('with local prisma installation', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('getLocalPrismaVersion should return version from local package.json', async () => {
    // Create a mock local prisma installation
    const prismaDir = path.join(tempDir, 'node_modules', 'prisma')
    fs.mkdirSync(prismaDir, { recursive: true })
    fs.writeFileSync(
      path.join(prismaDir, 'package.json'),
      JSON.stringify({ name: 'prisma', version: '5.10.2' }),
    )

    const version = await getLocalPrismaVersion(tempDir)
    expect(version).toBe('5.10.2')
  })

  it('getLocalPrismaVersion should return null for malformed package.json', async () => {
    const prismaDir = path.join(tempDir, 'node_modules', 'prisma')
    fs.mkdirSync(prismaDir, { recursive: true })
    fs.writeFileSync(path.join(prismaDir, 'package.json'), 'not valid json')

    const version = await getLocalPrismaVersion(tempDir)
    expect(version).toBeNull()
  })

  it('getLocalPrismaVersion should return null for package.json without version', async () => {
    const prismaDir = path.join(tempDir, 'node_modules', 'prisma')
    fs.mkdirSync(prismaDir, { recursive: true })
    fs.writeFileSync(
      path.join(prismaDir, 'package.json'),
      JSON.stringify({ name: 'prisma' }),
    )

    const version = await getLocalPrismaVersion(tempDir)
    expect(version).toBeNull()
  })
})
