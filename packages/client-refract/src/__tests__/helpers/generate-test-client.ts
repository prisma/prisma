import { parseSchema } from '@refract/schema-parser'
import { ClientGenerator } from '../../client-generator'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

/**
 * Generate a Refract client from the test schema
 * Writes the generated client to a temporary location and returns the path
 */
export function generateTestClient(): string {
  // Read test schema
  const schemaPath = join(__dirname, 'test-schema.prisma')
  const schemaContent = readFileSync(schemaPath, 'utf-8')

  // Parse schema
  const { ast: schemaAST } = parseSchema(schemaContent)

  // Generate client code
  const generator = new ClientGenerator(schemaAST, { dialect: 'postgresql' })
  const generatedCode = generator.generateClientModule()

  // Write to temporary location
  const outputDir = join(__dirname, '../fixtures')
  const outputPath = join(outputDir, 'generated-test-client.ts')

  mkdirSync(outputDir, { recursive: true })
  writeFileSync(outputPath, generatedCode, 'utf-8')

  return outputPath
}

/**
 * Import the generated test client
 * Returns the createRefractClient function from the generated code
 */
export async function importTestClient() {
  const clientPath = generateTestClient()

  // Dynamic import with cache busting
  const timestamp = Date.now()
  const module = await import(`${clientPath}?t=${timestamp}`)

  // Return createRefractClient which accepts a Dialect, not createClient which auto-loads config
  return module.createRefractClient
}
