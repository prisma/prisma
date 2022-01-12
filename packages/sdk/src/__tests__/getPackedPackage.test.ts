import { getPackedPackage } from './../getPackedPackage'
import path from 'path'
import fs from 'fs'

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
  }, 20000)
})
