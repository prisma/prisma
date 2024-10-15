import { bold, green } from 'kleur/colors'

import { getPackageCmd } from '../../../../../internals/src/get-generators/generatorResolvers/prisma-client-js/auto-installation/getPackageCmd'
import { resolvePkg } from '../../../../../internals/src/get-generators/generatorResolvers/prisma-client-js/check-dependencies/resolve'

const { readFile, writeFile } = require('fs').promises
const { execSync } = require('child_process')

describe('Test to check for [object Promise] error', () => {
  let originalPackage
  let originalPackageManager
  let originalPlatform = process.platform

  beforeAll(async () => {
    originalPlatform = process.platform
    Object.defineProperty(process, 'platform', { value: 'win32' })
    const packageContent = await readFile('./package.json', 'utf-8')
    originalPackage = JSON.parse(packageContent)
    originalPackageManager = originalPackage.packageManager
    originalPackage.packageManager = 'yarn'
    await writeFile('./package.json', JSON.stringify(originalPackage))
  })

  test('Test 1: Does the first error message not show [object Promise]?', async () => {
    try {
      execSync('cd .. && yarn prisma generate', { stdio: 'pipe', encoding: 'utf-8' })
    } catch (error) {
      let baseDir

      const prismaCliDir = await resolvePkg('prisma', { basedir: baseDir })
      const hasCli = (s: string) => (prismaCliDir !== undefined ? s : '')
      const missingCli = (s: string) => (prismaCliDir === undefined ? s : '')

      const prisma = await getPackageCmd(baseDir, 'add', 'prisma', '-D')
      const prismaClient = await getPackageCmd(baseDir, 'add', '@prisma/client')

      //This message should not show [object Promise].
      const errorMessageWithAwait = `Could not resolve ${missingCli(`${bold('prisma')} and `)}${bold(
        '@prisma/client',
      )} in the current project. Please install ${hasCli('it')}${missingCli('them')} with ${missingCli(
        `${bold(green(`${prisma}`))} and `,
      )}${bold(green(`${prismaClient}`))}, and rerun ${bold(
        await getPackageCmd(baseDir, 'execute', 'prisma generate'),
      )} 🙏.`

      //Error message with await added. This test should pass since the correct message is displayed.
      console.info(errorMessageWithAwait)
      expect(errorMessageWithAwait.includes('[object Promise]')).toBeFalsy()
    }
  })

  test('Test 2: Does the second error message show [object Promise]?', async () => {
    try {
      execSync('cd .. && yarn prisma generate', { stdio: 'pipe', encoding: 'utf-8' })
    } catch (error) {
      let baseDir
      const prismaCliDir = await resolvePkg('prisma', { basedir: baseDir })
      const hasCli = (s: string) => (prismaCliDir !== undefined ? s : '')
      const missingCli = (s: string) => (prismaCliDir === undefined ? s : '')

      const prisma = getPackageCmd(baseDir, 'add', 'prisma', '-D')
      const prismaClient = getPackageCmd(baseDir, 'add', '@prisma/client')

      //This message should show [object Promise].
      const errorMessageWithoutAwait = `Could not resolve ${missingCli(`${bold('prisma')} and `)}${bold(
        '@prisma/client',
      )} in the current project. Please install ${hasCli('it')}${missingCli('them')} with ${missingCli(
        `${bold(green(`${prisma}`))} and `,
      )}${bold(green(`${prismaClient}`))}, and rerun ${bold(
        await getPackageCmd(baseDir, 'execute', 'prisma generate'),
      )} 🙏.`

      //Error message without await added. This test should fail since [object Promise] shows up.
      console.info(errorMessageWithoutAwait)
      expect(errorMessageWithoutAwait.includes('[object Promise]')).toBeTruthy()
    }
  })

  afterAll(async () => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
    originalPackage.packageManager = originalPackageManager
    await writeFile('./package.json', JSON.stringify(originalPackage))
  })
})
