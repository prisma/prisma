import process from 'node:process'
import path from 'node:path'
import { defineConfig } from 'src/index'

export default defineConfig({
  schema: path.join(process.cwd(), 'prisma', 'schema'),
})
