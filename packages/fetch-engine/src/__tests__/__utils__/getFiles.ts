import fs from 'fs'
import path from 'path'

export function getFiles(dir: string): Array<{ name: string; size: number }> {
  const files = fs.readdirSync(dir, 'utf8')
  return files.map((name) => {
    const size = fs.statSync(path.join(dir, name)).size

    return { name, size }
  })
}

export function getAllFilesRecursively(dir: string): Array<{ name: string; size: number }> {
  const files = fs.readdirSync(dir, { withFileTypes: true })
  const result: { name: string; size: number }[] = []

  for (const file of files) {
    if (file.isDirectory()) {
      result.push(...getAllFilesRecursively(path.join(dir, file.name)))
    } else {
      result.push({ name: file.name, size: fs.statSync(path.join(dir, file.name)).size })
    }
  }
  return result
}
