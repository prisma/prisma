import path from 'path'

export function absolutizeRelativePath(url: string, cwd: string, outputDir: string, absolutePaths?: boolean): string {
  let filePath = url

  if (filePath.startsWith('file:')) {
    filePath = filePath.slice(5)
  }

  const absoluteTarget = path.resolve(cwd, filePath)

  if (absolutePaths) {
    return absoluteTarget
  }

  return `${path.relative(outputDir, absoluteTarget)}`
}
