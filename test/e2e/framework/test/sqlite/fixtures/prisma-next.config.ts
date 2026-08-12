import { defineConfig } from '@prisma/orm-sqlite/config';

export default defineConfig({
  contract: './contract.ts',
  output: './generated',
});
