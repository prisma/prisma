import fs from 'fs'
import { promisify } from 'util'

const readdir = promisify(fs.readdir)
const allowList = ['.DS_Store']

export async function isDirEmpty(dir: string): Promise<boolean> {
  const files = await readdir(dir)
  return files.filter((f) => !allowList.includes(f)).length === 0
}
