import { DataSource } from '@prisma/lift'
import path from 'path'

export function resolveDatasources(datasources: DataSource[], cwd: string, outputDir: string): DataSource[] {
  return datasources.map(datasource => {
    if (datasource.connectorType === 'sqlite') {
      return {
        ...datasource,
        url: absolutizeRelativePath(datasource.url, cwd, outputDir),
      }
    }
    return datasource
  })
}

export function absolutizeRelativePath(url: string, cwd: string, outputDir: string): string {
  let filePath = url

  if (filePath.startsWith('file:')) {
    filePath = filePath.slice(5)
  }

  const absoluteTarget = path.resolve(cwd, filePath)

  return `'file:' + path.resolve(__dirname, '${path.relative(outputDir, absoluteTarget)}')`
}
