import { defineConfig } from '@prisma/orm-postgres/config';

export default defineConfig({
  contract: './contract.ts',
  output: './generated',
});
