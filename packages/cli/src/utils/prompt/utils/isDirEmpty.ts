import fs from 'fs-extra'

const allowList = ['.DS_Store']

export async function isDirEmpty(dir: string): Promise<boolean> {
  const files = await fs.readdir(dir)
  return files.filter((f) => !allowList.includes(f)).length === 0
}
