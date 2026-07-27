import { defineConfig } from '@prisma-next/mongo/config';

export default defineConfig({
  contract: './contract.prisma',
  output: 'generated',
});
