import fs from 'node:fs'
import path from 'node:path'

import { Schema as Shape } from 'effect'
import { readConfigFile } from 'typescript'

/**
 * Determines the client output path relative to the schema directory.
 *
 * @param schemaDir absolute path to the schema directory
 * @returns client output path relative to the schema directory
 */
export function determineClientOutputPath(schemaDir: string): string {
  const sourceDir = getSourceDir()
  const outputPath = path.join(sourceDir, 'generated', 'prisma')
  const relativeOutputPath = path.relative(schemaDir, outputPath)

  // Normalize path separators to forward slashes
  return relativeOutputPath.replaceAll(path.sep, '/')
}

/**
 * Determines the absolute path to the source directory.
 */
function getSourceDir(): string {
  const projectDir = process.cwd()

  const sourceRootFromTsConfig = getSourceDirFromTypeScriptConfig()

  if (sourceRootFromTsConfig) {
    return path.join(projectDir, sourceRootFromTsConfig)
  }

  // Check common source directories if there's no tsconfig.json
  for (const dir of ['src', 'lib', 'app']) {
    const absoluteSourceDir = path.join(projectDir, dir)
    if (fs.existsSync(absoluteSourceDir)) {
      return absoluteSourceDir
    }
  }

  // Default fallback if we can't determine anything better
  return projectDir
}

function getSourceDirFromTypeScriptConfig(): string | undefined {
  try {
    const tsconfig = loadTypeScriptConfig('tsconfig.json')
    return (
      tsconfig.compilerOptions?.rootDir ?? tsconfig.compilerOptions?.baseUrl ?? tsconfig.compilerOptions?.rootDirs?.[0]
    )
  } catch {
    return undefined
  }
}

const tsconfigSchema = Shape.partial(
  Shape.Struct(
    {
      extends: Shape.String,
      compilerOptions: Shape.partial(
        Shape.Struct(
          {
            rootDir: Shape.String,
            rootDirs: Shape.Array(Shape.String),
            baseUrl: Shape.String,
          },
          { key: Shape.String, value: Shape.Unknown },
        ),
      ),
    },
    { key: Shape.String, value: Shape.Unknown },
  ),
)

const parseTsConfig = Shape.decodeUnknownSync(tsconfigSchema)

function loadTypeScriptConfig(configPath: string): typeof tsconfigSchema.Type {
  const loadResult = readConfigFile(configPath, (path) => fs.readFileSync(path, 'utf8'))

  if (loadResult.error) {
    throw loadResult.error
  }

  const config = parseTsConfig(loadResult.config)

  if (config.extends) {
    const parentConfigPath = path.join(path.dirname(configPath), config.extends)
    const parentConfig = loadTypeScriptConfig(parentConfigPath)
    return {
      ...parentConfig,
      ...config,
      compilerOptions: { ...(parentConfig.compilerOptions ?? {}), ...(config.compilerOptions ?? {}) },
    }
  }

  return config
}
