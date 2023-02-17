import fs from 'fs/promises'

export async function clearDir(path: string) {
  await fs.rm(path, { recursive: true, force: true })
  await fs.mkdir(path, { recursive: true })
}
