import { defineConfig } from '@repo/tsdown';

export default defineConfig({
  entry: [
    'src/exports/control.ts',
    'src/exports/index-types.ts',
    'src/exports/operation-types.ts',
    'src/exports/pack.ts',
    'src/exports/runtime.ts',
  ],
});
