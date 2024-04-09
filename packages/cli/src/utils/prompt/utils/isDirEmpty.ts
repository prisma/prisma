import fs from 'fs'

const allowList = ['.DS_Store']

export async function isDirEmpty(dir: string): Promise<boolean> {
  const files = await fs.promises.readdir(dir)
  return files.filter((f) => !allowList.includes(f)).length === 0
}
