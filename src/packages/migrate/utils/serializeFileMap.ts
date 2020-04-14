import fs from 'fs'
import { promisify } from 'util'
import { FileMap } from '../types'
import path from 'path'
import makeDir from 'make-dir'

const writeFile = promisify(fs.writeFile)

const madeDirs = {}

export async function serializeFileMap(fileMap: FileMap, dir: string): Promise<void> {
  await makeDir(dir)
  await Promise.all(
    Object.entries(fileMap).map(async ([fileName, file]) => {
      const filePath = path.join(dir, fileName)
      const fileDir = path.dirname(filePath)
      if (!madeDirs[fileDir]) {
        await makeDir(fileDir)
        madeDirs[fileDir]
      }
      await writeFile(filePath, file)
    }),
  )
}
