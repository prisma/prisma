import { readFileSync } from 'node:fs'

const exampleEnvFiles = ['.env.example', '.example.env']

exampleEnvFiles.forEach((file) => {
  const fileContents = readFileSync(file, 'utf8')

  if (!fileContents.includes('DATABASE_URL="file:./dev.db"')) {
    console.error(`${file} does not contain env var from init command"`)
    process.exit(1)
  }
})
