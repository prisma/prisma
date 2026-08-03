import { defineConfig } from '@repo/tsdown';

export default defineConfig({
  entry: ['src/exports/config-types.ts', 'src/exports/config-validation.ts'],
});
