import { defineConfig } from '@repo/tsdown';

export default defineConfig({
  entry: {
    index: 'src/exports/index.ts',
    control: 'src/exports/control.ts',
    runtime: 'src/exports/runtime.ts',
    codecs: 'src/exports/codecs.ts',
    'codec-types': 'src/exports/codec-types.ts',
    'codec-ids': 'src/exports/codec-ids.ts',
  },
});
