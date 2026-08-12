import { defineConfig } from '@internal/sqlite/config';

export default defineConfig({
  contract: './contract.ts',
  output: 'generated',
});
