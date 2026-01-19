import { spawn } from 'node:child_process'

import { existsSync } from 'fs'
import { join } from 'path'

export type PackageManagerName = 'pnpm' | 'npm' | 'yarn'

export type PackageManager = {
  name: PackageManagerName
  installDev: (packages: string[]) => { command: string; args: string[] }
  installProd: (packages: string[]) => { command: string; args: string[] }
}

const PACKAGE_MANAGER_FILES: Record<PackageManagerName, string> = {
  pnpm: 'pnpm-lock.yaml',
  yarn: 'yarn.lock',
  npm: 'package-lock.json',
}

export const detectPackageManager = (cwd: string): PackageManagerName => {
  if (existsSync(join(cwd, PACKAGE_MANAGER_FILES.pnpm))) {
    return 'pnpm'
  }
  if (existsSync(join(cwd, PACKAGE_MANAGER_FILES.yarn))) {
    return 'yarn'
  }
  if (existsSync(join(cwd, PACKAGE_MANAGER_FILES.npm))) {
    return 'npm'
  }

  return 'npm'
}

export const getPackageManager = (name: PackageManagerName): PackageManager => {
  const installers: Record<PackageManagerName, PackageManager> = {
    pnpm: {
      name,
      installDev: (packages) => ({ command: 'pnpm', args: ['add', '-D', ...packages] }),
      installProd: (packages) => ({ command: 'pnpm', args: ['add', ...packages] }),
    },
    yarn: {
      name,
      installDev: (packages) => ({ command: 'yarn', args: ['add', '-D', ...packages] }),
      installProd: (packages) => ({ command: 'yarn', args: ['add', ...packages] }),
    },
    npm: {
      name,
      installDev: (packages) => ({ command: 'npm', args: ['install', '-D', ...packages] }),
      installProd: (packages) => ({ command: 'npm', args: ['install', ...packages] }),
    },
  }

  return installers[name]
}

export const runInstall = (command: string, args: string[], cwd: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', cwd })
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`Install command failed with exit code ${code}`))
    })
    child.on('error', reject)
  })
