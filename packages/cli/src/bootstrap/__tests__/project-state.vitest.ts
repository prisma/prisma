import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, test } from 'vitest'

import { detectProjectState, getModelNames, getSeedCommand } from '../project-state'

let tmpDir: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prisma-bootstrap-state-'))
})

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('detectProjectState', () => {
  test('returns all false for empty directory', () => {
    const state = detectProjectState(tmpDir)

    expect(state.hasPackageJson).toBe(false)
    expect(state.hasSchemaFile).toBe(false)
    expect(state.hasPrismaConfig).toBe(false)
    expect(state.hasEnvFile).toBe(false)
    expect(state.hasModels).toBe(false)
    expect(state.hasSeedScript).toBe(false)
  })

  test('detects package.json', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{}', 'utf-8')
    const state = detectProjectState(tmpDir)

    expect(state.hasPackageJson).toBe(true)
  })

  test('detects prisma/schema.prisma', () => {
    const prismaDir = path.join(tmpDir, 'prisma')
    fs.mkdirSync(prismaDir)
    fs.writeFileSync(path.join(prismaDir, 'schema.prisma'), `datasource db { provider = "postgresql" }`, 'utf-8')
    const state = detectProjectState(tmpDir)

    expect(state.hasSchemaFile).toBe(true)
    expect(state.hasModels).toBe(false)
  })

  test('detects schema.prisma at root', () => {
    fs.writeFileSync(path.join(tmpDir, 'schema.prisma'), `datasource db { provider = "postgresql" }`, 'utf-8')
    const state = detectProjectState(tmpDir)

    expect(state.hasSchemaFile).toBe(true)
  })

  test('detects models in schema', () => {
    const prismaDir = path.join(tmpDir, 'prisma')
    fs.mkdirSync(prismaDir)
    fs.writeFileSync(
      path.join(prismaDir, 'schema.prisma'),
      `
datasource db {
  provider = "postgresql"
  url = env("DATABASE_URL")
}

model User {
  id   Int    @id @default(autoincrement())
  name String
}
`,
      'utf-8',
    )
    const state = detectProjectState(tmpDir)

    expect(state.hasModels).toBe(true)
  })

  test('detects prisma.config.ts', () => {
    fs.writeFileSync(path.join(tmpDir, 'prisma.config.ts'), 'export default {}', 'utf-8')
    const state = detectProjectState(tmpDir)

    expect(state.hasPrismaConfig).toBe(true)
  })

  test('detects .env', () => {
    fs.writeFileSync(path.join(tmpDir, '.env'), 'DATABASE_URL=test', 'utf-8')
    const state = detectProjectState(tmpDir)

    expect(state.hasEnvFile).toBe(true)
  })

  test('detects seed script in package.json', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ prisma: { seed: 'ts-node prisma/seed.ts' } }),
      'utf-8',
    )
    const state = detectProjectState(tmpDir)

    expect(state.hasSeedScript).toBe(true)
  })

  test('returns false for seed when prisma.seed is empty', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ prisma: { seed: '' } }), 'utf-8')
    const state = detectProjectState(tmpDir)

    expect(state.hasSeedScript).toBe(false)
  })

  test('returns false for seed when prisma key is missing', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'test' }), 'utf-8')
    const state = detectProjectState(tmpDir)

    expect(state.hasSeedScript).toBe(false)
  })

  test('detects seed script in prisma.config.ts', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'prisma.config.ts'),
      `import { defineConfig } from 'prisma/config'\nexport default defineConfig({ migrations: { seed: 'tsx ./prisma/seed.ts' } })`,
      'utf-8',
    )
    const state = detectProjectState(tmpDir)

    expect(state.hasSeedScript).toBe(true)
  })

  test('detects seed script in prisma.config.ts with different formatting', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'prisma.config.ts'),
      `export default defineConfig({\n  migrations: {\n    seed: "npx tsx prisma/seed.ts",\n  },\n})`,
      'utf-8',
    )
    const state = detectProjectState(tmpDir)

    expect(state.hasSeedScript).toBe(true)
  })

  test('returns false for seed when prisma.config.ts has no seed field', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'prisma.config.ts'),
      `export default defineConfig({ migrations: { path: 'prisma/migrations' } })`,
      'utf-8',
    )
    const state = detectProjectState(tmpDir)

    expect(state.hasSeedScript).toBe(false)
  })
})

describe('getModelNames', () => {
  test('returns empty array when no schema exists', () => {
    expect(getModelNames(tmpDir)).toEqual([])
  })

  test('extracts model names from schema', () => {
    const prismaDir = path.join(tmpDir, 'prisma')
    fs.mkdirSync(prismaDir)
    fs.writeFileSync(
      path.join(prismaDir, 'schema.prisma'),
      `
datasource db { provider = "postgresql" }

model User {
  id   Int    @id
  name String
  posts Post[]
}

model Post {
  id     Int    @id
  title  String
  author User   @relation(fields: [authorId], references: [id])
  authorId Int
}
`,
      'utf-8',
    )

    expect(getModelNames(tmpDir)).toEqual(['User', 'Post'])
  })

  test('returns empty array for schema without models', () => {
    const prismaDir = path.join(tmpDir, 'prisma')
    fs.mkdirSync(prismaDir)
    fs.writeFileSync(path.join(prismaDir, 'schema.prisma'), `datasource db { provider = "postgresql" }`, 'utf-8')

    expect(getModelNames(tmpDir)).toEqual([])
  })
})

describe('getSeedCommand', () => {
  test('returns null when no seed config exists', () => {
    expect(getSeedCommand(tmpDir)).toBeNull()
  })

  test('returns seed command from package.json', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ prisma: { seed: 'ts-node prisma/seed.ts' } }),
      'utf-8',
    )

    expect(getSeedCommand(tmpDir)).toBe('ts-node prisma/seed.ts')
  })

  test('returns seed command from prisma.config.ts', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'prisma.config.ts'),
      `export default defineConfig({ migrations: { seed: 'npx tsx prisma/seed.ts' } })`,
      'utf-8',
    )

    expect(getSeedCommand(tmpDir)).toBe('npx tsx prisma/seed.ts')
  })

  test('prefers package.json over prisma.config.ts', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ prisma: { seed: 'ts-node prisma/seed.ts' } }),
      'utf-8',
    )
    fs.writeFileSync(
      path.join(tmpDir, 'prisma.config.ts'),
      `export default defineConfig({ migrations: { seed: 'npx tsx prisma/seed.ts' } })`,
      'utf-8',
    )

    expect(getSeedCommand(tmpDir)).toBe('ts-node prisma/seed.ts')
  })
})
