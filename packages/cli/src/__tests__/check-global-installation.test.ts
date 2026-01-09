import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { shouldWarnAboutGlobalInstallation, getLocalPrismaVersion } from '../utils/check-global-installation'

describe('shouldWarnAboutGlobalInstallation', () => {
  it('should return false when no local prisma is installed', () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-test-nolocal-'))
    try {
      const result = shouldWarnAboutGlobalInstallation(projectDir)
      expect(result).toBe(false)
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true })
    }
  })

  it('should return false for non-existent project directory', () => {
    const projectDir = path.join(os.tmpdir(), `prisma-test-missing-${Date.now()}-${Math.random()}`)
    const result = shouldWarnAboutGlobalInstallation(projectDir)
    expect(result).toBe(false)
  })
})

describe('getLocalPrismaVersion', () => {
  it('should return null when no local prisma is installed', async () => {
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-test-nolocal-'))
    try {
      const result = await getLocalPrismaVersion(projectDir)
      expect(result).toBeNull()
    } finally {
      fs.rmSync(projectDir, { recursive: true, force: true })
    }
  })

  it('should return null for non-existent project directory', async () => {
    const projectDir = path.join(os.tmpdir(), `prisma-test-missing-${Date.now()}-${Math.random()}`)
    const result = await getLocalPrismaVersion(projectDir)
    expect(result).toBeNull()
  })
})

describe('with local prisma installation', () => {
  let tempDir: string

  function writeLocalPrismaPackageJson(pkg: unknown) {
    const prismaDir = path.join(tempDir, 'node_modules', 'prisma')
    fs.mkdirSync(prismaDir, { recursive: true })
    const content = typeof pkg === 'string' ? pkg : JSON.stringify(pkg)
    fs.writeFileSync(path.join(prismaDir, 'package.json'), content + '\n', 'utf8')
    return prismaDir
  }

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-test-'))
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('shouldWarnAboutGlobalInstallation returns true when local install exists but CLI runs from outside it', () => {
    writeLocalPrismaPackageJson({ name: 'prisma', version: '5.10.2' })

    const result = shouldWarnAboutGlobalInstallation(tempDir)
    expect(result).toBe(true)
  })

  it('getLocalPrismaVersion should return version from local package.json', async () => {
    writeLocalPrismaPackageJson({ name: 'prisma', version: '5.10.2' })

    const version = await getLocalPrismaVersion(tempDir)
    expect(version).toBe('5.10.2')
  })

  it('getLocalPrismaVersion should return null for malformed package.json', async () => {
    writeLocalPrismaPackageJson('not valid json')

    const version = await getLocalPrismaVersion(tempDir)
    expect(version).toBeNull()
  })

  it('getLocalPrismaVersion should return null for package.json without version', async () => {
    writeLocalPrismaPackageJson({ name: 'prisma' })

    const version = await getLocalPrismaVersion(tempDir)
    expect(version).toBeNull()
  })
})
