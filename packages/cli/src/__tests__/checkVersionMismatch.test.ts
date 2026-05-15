import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'

import packageJson from '../../package.json'
import { checkVersionMismatch } from '../utils/checkVersionMismatch'

const tempDirs: string[] = []

describe('checkVersionMismatch', () => {
  const globalVersion = packageJson.version
  let consoleWarnMock: jest.SpyInstance

  beforeEach(() => {
    consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(async () => {
    consoleWarnMock.mockRestore()
    await Promise.all(tempDirs.splice(0).map((tempDir) => fs.rm(tempDir, { recursive: true, force: true })))
  })

  test('warns when local prisma version differs from the global CLI version', async () => {
    const cwd = await createProject({
      dependencies: {
        prisma: '0.0.1',
        '@prisma/client': globalVersion,
      },
    })

    await checkVersionMismatch(cwd)

    expect(consoleWarnMock).toHaveBeenCalledTimes(1)
    expect(stripVTControlCharacters(consoleWarnMock.mock.calls[0][0])).toBe(
      `prisma warn Your global prisma version (${globalVersion}) differs from local version (0.0.1). Run npm install prisma@${globalVersion} to align.`,
    )
  })

  test('warns when prisma is missing and @prisma/client differs from the global CLI version', async () => {
    const cwd = await createProject({
      dependencies: {
        '@prisma/client': '0.0.2',
      },
    })

    await checkVersionMismatch(cwd)

    expect(consoleWarnMock).toHaveBeenCalledTimes(1)
    expect(stripVTControlCharacters(consoleWarnMock.mock.calls[0][0])).toBe(
      `prisma warn Your global prisma version (${globalVersion}) differs from local version (0.0.2). Run npm install prisma@${globalVersion} to align.`,
    )
  })

  test('does not warn when the local prisma range resolves to the global CLI version', async () => {
    const cwd = await createProject({
      devDependencies: {
        prisma: `^${globalVersion}`,
      },
    })

    await checkVersionMismatch(cwd)

    expect(consoleWarnMock).not.toHaveBeenCalled()
  })

  test('does not warn when versions match exactly', async () => {
    const cwd = await createProject({
      dependencies: {
        prisma: globalVersion,
        '@prisma/client': globalVersion,
      },
    })

    await checkVersionMismatch(cwd)

    expect(consoleWarnMock).not.toHaveBeenCalled()
  })

  test('does not warn when no prisma dependencies are found', async () => {
    const cwd = await createProject({
      dependencies: {
        'some-other-package': '1.0.0',
      },
    })

    await checkVersionMismatch(cwd)

    expect(consoleWarnMock).not.toHaveBeenCalled()
  })

  test('does not warn when package.json cannot be read', async () => {
    const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'prisma-cli-version-mismatch-'))
    tempDirs.push(cwd)
    // No package.json created

    await checkVersionMismatch(cwd)

    expect(consoleWarnMock).not.toHaveBeenCalled()
  })

  test('warns when @prisma/client differs even when prisma is not installed', async () => {
    const cwd = await createProject({
      dependencies: {
        '@prisma/client': '1.2.3',
      },
    })

    await checkVersionMismatch(cwd)

    expect(consoleWarnMock).toHaveBeenCalledTimes(1)
    expect(stripVTControlCharacters(consoleWarnMock.mock.calls[0][0])).toBe(
      `prisma warn Your global prisma version (${globalVersion}) differs from local version (1.2.3). Run npm install prisma@${globalVersion} to align.`,
    )
  })

  test('handles tilde version ranges that resolve to global version', async () => {
    const [major, minor] = globalVersion.split('.')
    const tildeRange = `~${major}.${minor}.0`
    
    const cwd = await createProject({
      devDependencies: {
        prisma: tildeRange,
      },
    })

    await checkVersionMismatch(cwd)

    // Should not warn since the range includes the global version
    expect(consoleWarnMock).not.toHaveBeenCalled()
  })
})

async function createProject(packageJsonContent: Record<string, unknown>): Promise<string> {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'prisma-cli-version-mismatch-'))
  tempDirs.push(cwd)

  await fs.writeFile(path.join(cwd, 'package.json'), JSON.stringify(packageJsonContent), 'utf8')

  return cwd
}
