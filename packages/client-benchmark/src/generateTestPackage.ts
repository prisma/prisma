import fs from 'fs/promises'
import path from 'path'

import { clearDir } from './fs'
import { pnpmInstall } from './pnpm'
import { Target } from './targets/base'

export const LOCAL_VERSION = 'local'

const workspaceYaml = `
packages:
  - '*'
`

const npmConfig = `
node-linker=hoisted
`

export async function generateTestPackage(target: Target, workbenchPath: string, prismaVersion: string) {
  await clearDir(workbenchPath)
  await fs.writeFile(
    path.join(workbenchPath, 'package.json'),
    JSON.stringify(getPackageJsonContent(prismaVersion), null, 2),
    'utf8',
  )

  await fs.writeFile(path.join(workbenchPath, 'pnpm-workspace.yaml'), workspaceYaml, 'utf8')
  await fs.writeFile(path.join(workbenchPath, '.npmrc'), npmConfig, 'utf8')

  await pnpmInstall(workbenchPath)
  await target.afterPnpmInstall(workbenchPath)
}

function getPackageJsonContent(prismaVersion: string) {
  const { cliVersion, clientVersion, instrumentationVersion } = getPackagesVersion(prismaVersion)
  return {
    name: 'prisma-bench-test',
    private: true,
    dependencies: {
      prisma: cliVersion,
      '@prisma/client': clientVersion,
      '@prisma/instrumentation': instrumentationVersion,
    },
  }
}

function getPackagesVersion(prismaVersion: string) {
  if (prismaVersion === LOCAL_VERSION) {
    return {
      clientVersion: '../../client',
      instrumentationVersion: '../../instrumentation',
      cliVersion: '../../cli',
    }
  }

  return {
    clientVersion: prismaVersion,
    instrumentationVersion: prismaVersion,
    cliVersion: prismaVersion,
  }
}
