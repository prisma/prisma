import fs from 'node:fs'
import path from 'node:path'

export interface ProjectState {
  hasPackageJson: boolean
  hasSchemaFile: boolean
  hasPrismaConfig: boolean
  hasEnvFile: boolean
  hasModels: boolean
  hasSeedScript: boolean
}

const SCHEMA_CANDIDATES = ['prisma/schema.prisma', 'schema.prisma']
const MODEL_PATTERN = /^\s*model\s+\w+/m

function findSchemaPath(baseDir: string): string | null {
  for (const candidate of SCHEMA_CANDIDATES) {
    const full = path.join(baseDir, candidate)
    if (fs.existsSync(full)) return full
  }
  return null
}

function checkSeedScript(baseDir: string): boolean {
  const packageJsonPath = path.join(baseDir, 'package.json')
  if (!fs.existsSync(packageJsonPath)) return false

  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
    return typeof pkg.prisma?.seed === 'string' && pkg.prisma.seed.length > 0
  } catch {
    return false
  }
}

export function detectProjectState(baseDir: string): ProjectState {
  const schemaPath = findSchemaPath(baseDir)
  const hasSchemaFile = schemaPath !== null
  let hasModels = false

  if (schemaPath) {
    const content = fs.readFileSync(schemaPath, 'utf-8')
    hasModels = MODEL_PATTERN.test(content)
  }

  return {
    hasPackageJson: fs.existsSync(path.join(baseDir, 'package.json')),
    hasSchemaFile,
    hasPrismaConfig: fs.existsSync(path.join(baseDir, 'prisma.config.ts')),
    hasEnvFile: fs.existsSync(path.join(baseDir, '.env')),
    hasModels,
    hasSeedScript: checkSeedScript(baseDir),
  }
}
