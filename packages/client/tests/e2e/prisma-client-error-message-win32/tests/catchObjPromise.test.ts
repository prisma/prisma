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

  test('Does the error message show [object Promise]?', async () => {
    try {
      execSync('cd .. && yarn prisma generate', { stdio: 'pipe', encoding: 'utf-8' })
    } catch (error) {
      let baseDir
      const prismaCliDir = await resolvePkg('prisma', { basedir: baseDir })
      const hasCli = (s: string) => (prismaCliDir !== undefined ? s : '')
      const missingCli = (s: string) => (prismaCliDir === undefined ? s : '')

      const yarnPrisma = getPackageCmd(baseDir, 'add', 'prisma', '-D')
      const yarnPrismaClient = getPackageCmd(baseDir, 'add', '@prisma/client')

      //This message should show [object Promise].
      const errorMessage = `Could not resolve ${missingCli(`${bold('prisma')} and `)}${bold(
        '@prisma/client',
      )} in the current project. Please install ${hasCli('it')}${missingCli('them')} with ${missingCli(
        `${bold(green(`${yarnPrisma}`))} and `,
      )}${bold(green(`${yarnPrismaClient}`))}, and rerun ${bold(
        await getPackageCmd(baseDir, 'execute', 'prisma generate'),
      )} 🙏.`

      //Explains what '[object Promise]' is if displayed in the error message when prisma and/or @prisma/client is not resolved.
      if (
        `${yarnPrisma}`.includes(`[object Promise]`) === true &&
        `${yarnPrismaClient}`.includes(`[object Promise]`) === true
      ) {
        console.info(
          errorMessage +
            `\n${bold(green(`${yarnPrisma}`))}` +
            ` should be ${bold(green('yarn add prisma -D'))} and ${bold(green(`${yarnPrismaClient}`))}` +
            ` should be ${bold(green('yarn add @prisma/client'))} respectively.`,
        )
      } else if (`${yarnPrisma}`.includes(`[object Promise]`) === true) {
        console.info(errorMessage + `\n${bold(green(`${yarnPrisma}`))} should be ${bold(green('yarn add prisma -D'))}.`)
      } else if (`${yarnPrismaClient}`.includes(`[object Promise]`) === true) {
        console.info(
          errorMessage + `\n${bold(green(`${yarnPrismaClient}`))} should be ${bold(green('yarn add @prisma/client'))}.`,
        )
      }
      //This test should fail if it's true that [object Promise] does show up in the error message.
      expect(errorMessage.includes('[object Promise]')).toBeTruthy()
    }
  })

  afterAll(async () => {
    Object.defineProperty(process, 'platform', { value: originalPlatform })
    originalPackage.packageManager = originalPackageManager
    await writeFile('./package.json', JSON.stringify(originalPackage))
  })
})
