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
    setupExternalTables: fs.readFileSync('./src/init.sql', 'utf-8'),
  },
})
