import arktypeJson from '@prisma/orm-extension-arktype-json/control';
import pgvector from '@prisma/orm-extension-pgvector/control';
import { defineConfig } from '@prisma/orm-postgres/config';

export default defineConfig({
  contract: './contract.ts',
  output: './generated',
  extensions: [pgvector, arktypeJson],
});
