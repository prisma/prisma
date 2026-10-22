import { defineConfig } from '@repo/tsdown';

export default defineConfig({
  entry: ['src/exports/config.ts', 'src/exports/contract-builder.ts', 'src/exports/control.ts'],
});
