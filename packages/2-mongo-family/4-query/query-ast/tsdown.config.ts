import { defineConfig } from '@repo/tsdown';

export default defineConfig({
  entry: {
    'exports/execution': 'src/exports/execution.ts',
    'exports/control': 'src/exports/control.ts',
  },
  exports: { enabled: false },
});
