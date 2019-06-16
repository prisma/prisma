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

  const isMusl = isAWSLambda()

  return {
    platform: 'linux',
    isMusl,
  }
}

// There doesn't seem to be a reliable way to
// check if the distro supports glibc's shared
// libraries or not.
//
// For now, we can add these checks as needed.
function isAWSLambda(): boolean {
  return !!process.env['AWS_EXECUTION_ENV']
}
