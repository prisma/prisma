import { defineConfig } from '@repo/tsdown';

export default defineConfig({
  entry: [
    'src/exports/codec-types.ts',
    'src/exports/codecs.ts',
    'src/exports/column-types.ts',
    'src/exports/control.ts',
    'src/exports/pack.ts',
    'src/exports/runtime.ts',
  ],
});
