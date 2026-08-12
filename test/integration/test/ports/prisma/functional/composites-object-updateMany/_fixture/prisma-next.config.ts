import { defineConfig } from '@internal/mongo/config';

export default defineConfig({
  contract: './contract.prisma',
  output: 'generated',
});
