import { defineConfig, env } from '@prisma/config'
import fs from 'fs'
export default defineConfig({
  datasource: {
    url: env('TEST_E2E_POSTGRES_URI'),
  },
  engine: 'classic',
  experimental: {
    externalTables: true,
  },
  tables: {
    external: ['invoicing.Invoice'],
  },
  enums: {
    external: ['invoicing.InvoiceStatus'],
  },
  migrations: {
    initShadowDb: fs.readFileSync('./src/init.sql', 'utf-8'),
  },
})
