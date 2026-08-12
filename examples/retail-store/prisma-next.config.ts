import { defineConfig } from '@prisma/orm-mongo/config';

export default defineConfig({
  contract: './src/contract.prisma',
  db: {
    connection: process.env['DB_URL'] ?? 'mongodb://localhost:27017/retail-store',
  },
});
