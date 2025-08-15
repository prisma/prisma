import { defineConfig } from '@prisma/config'
import fs from 'fs'

export default defineConfig({
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
