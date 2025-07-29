import fs from 'fs'
import { defineConfig } from 'prisma/config'

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
