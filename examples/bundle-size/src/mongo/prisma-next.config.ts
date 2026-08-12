import { defineConfig } from '@prisma/orm-mongo/config';

export default defineConfig({
  contract: './contract.ts',
  output: './generated',
});
