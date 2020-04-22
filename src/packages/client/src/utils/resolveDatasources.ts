import { DataSource } from '@prisma/generator-helper'
import path from 'path'

export function resolveDatasources(
  datasources: DataSource[],
  cwd: string,
  outputDir: string,
  absolutePaths?: boolean,
): DataSource[] {
  return datasources.map((datasource) => {
    if (datasource.connectorType === 'sqlite') {
      if (datasource.url.fromEnvVar === null) {
        return {
          ...datasource,
          url: {
            fromEnvVar: null,
            value: absolutizeRelativePath(
              datasource.url.value,
              cwd,
              outputDir,
              absolutePaths,
            ),
          },
        }
      } else {
        return datasource
      }
    }
    return datasource
  })
}

export function absolutizeRelativePath(
  url: string,
  cwd: string,
  outputDir: string,
  absolutePaths?: boolean,
): string {
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
