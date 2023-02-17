import execa from 'execa'
import fs from 'fs/promises'
import path from 'path'

import { Target } from './base'

export class LocalTarget implements Target {
  getBinaryTargets(): string[] {
    return ['native']
  }

  async afterPnpmInstall(workbenchPath: string): Promise<void> {
    await fs.copyFile(path.join(__dirname, 'measureLocal.mjs'), path.join(workbenchPath, 'measureLocal.mjs'))
  }

  async afterClientGeneration() {}

  async measure(workbenchPath: string): Promise<Record<string, number>> {
    const { stdout } = await execa('node', [path.join(workbenchPath, 'measureLocal.mjs')], {
      env: {
        PRISMA_SHOW_ALL_TRACES: 'true',
      },
    })

    return JSON.parse(stdout)
  }
}
