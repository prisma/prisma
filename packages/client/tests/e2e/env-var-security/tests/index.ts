import * as fs from 'fs'
import * as path from 'path'

const DATABASE_URL = 'file:./secret-database-url-env-var-value.db'
const FILE_EXTENSION_TO_CHECK = ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.json', '.prisma', '.d.ts']

function getFilesToCheckInDir(dir: string): string[] {
  const files: string[] = []
  const items = fs.readdirSync(dir)

  for (const item of items) {
    const fullPath = path.join(dir, item)
    const stats = fs.statSync(fullPath)

    if (stats.isDirectory()) {
      files.push(...getFilesToCheckInDir(fullPath))
    } else if (stats.isFile() && FILE_EXTENSION_TO_CHECK.includes(path.extname(fullPath))) {
      files.push(fullPath)
    }
  }

  return files
}

test('no generated files contain ENV var values', () => {
  const generatedDir = path.join(process.cwd(), 'generated')
  const filesToCheck = getFilesToCheckInDir(generatedDir)

  console.log('files to check: ', filesToCheck)
  expect(filesToCheck.length).toBeGreaterThan(0)

  for (const file of filesToCheck) {
    console.log(`checking file ${file}...: `)
    const content = fs.readFileSync(file, 'utf8')
    expect(content).not.toContain(DATABASE_URL)
  }
})

export {}
