import { defineConfig } from '@prisma/orm-mongo/config';

export default defineConfig({
  contract: './src/contract.prisma',
  db: {
    connection: process.env['MONGODB_URL'] ?? 'mongodb://localhost:27017/mongo-demo',
  },
});
