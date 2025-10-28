import path from 'node:path'

import { defineConfig } from '@prisma/config'

const basePath = process.cwd()

// @ts-expect-error — intentionally missing datasource block
export default defineConfig({
  engine: 'classic',
  schema: path.join(basePath, 'schema.prisma'),
})
