import { defineConfig } from '@repo/tsdown';

export default defineConfig({
  entry: {
    'exports/index': 'src/exports/index.ts',
    sender: 'src/sender.ts',
  },
  exports: { enabled: false },
});
