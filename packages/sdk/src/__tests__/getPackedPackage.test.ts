import fs from 'fs'
import path from 'path'

import { getPackedPackage } from './../getPackedPackage'

const isMacOrWindowsCI = Boolean(process.env.CI) && ['darwin', 'win32'].includes(process.platform)
if (isMacOrWindowsCI) {
  jest.setTimeout(60_000)
} else {
  jest.setTimeout(20_000)
}

describe('getPackedPackage', () => {
  it('test argument vulnerability', async () => {
    const outputDir = '/tmp/some-prisma-target-folder'
    const packageDir = 'foo`touch /tmp/getPackedPackage-exploit`'

    try {
      await getPackedPackage('@prisma/client', path.join(__dirname, outputDir), packageDir)
    } catch (e) {
      //
    } finally {
      expect(fs.existsSync('/tmp/getPackedPackage-exploit')).toBe(false)
    }
  })
})
