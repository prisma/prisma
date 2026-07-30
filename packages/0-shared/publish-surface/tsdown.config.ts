import { defineConfig } from '@prisma-next/tsdown';

export default defineConfig({
  entry: ['src/shells.ts', 'src/import-roots.ts'],
});
