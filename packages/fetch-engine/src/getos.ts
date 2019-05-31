import fs from 'fs'
import { promisify } from 'util'
import os from 'os'

const exists = promisify(fs.exists)

export type GetOSResult = {
  platform: NodeJS.Platform
  isMusl: boolean
}

export async function getos() {
  const platform = os.platform()
  if (platform !== 'linux') {
    return {
      platform,
      isMusl: false,
    }
  }

  const isMusl = await exists('/etc/os-release')

  return {
    platform: 'linux',
    isMusl,
  }
}
