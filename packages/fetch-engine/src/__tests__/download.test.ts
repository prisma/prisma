import fs from 'fs'
import path from 'path'
import { download, getBinaryName } from '../download'
import { getPlatform } from '@prisma/get-platform'

describe('download', () => {
  test('basic download', async () => {
    const platform = await getPlatform()
    const targetPath = path.join(__dirname, getBinaryName('query-engine', platform))
    if (fs.existsSync(targetPath)) {
      try {
        fs.unlinkSync(targetPath)
      } catch (e) {
        console.error(e)
      }
    }
    await download({
      binaries: {
        'query-engine': __dirname,
      },
    })

    expect(fs.existsSync(targetPath))
  })
})
