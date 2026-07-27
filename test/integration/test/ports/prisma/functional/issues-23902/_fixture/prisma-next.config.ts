import { defineConfig } from '@prisma-next/postgres/config';

export default defineConfig({
  contract: './contract.prisma',
  output: 'generated',
});
