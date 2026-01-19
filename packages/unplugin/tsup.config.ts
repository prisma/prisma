import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    vite: 'src/vite.ts',
    webpack: 'src/webpack.ts',
    rollup: 'src/rollup.ts',
    esbuild: 'src/esbuild.ts',
  },
  format: ['cjs', 'esm'],
  target: 'node20',
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    'unplugin',
    'chokidar',
    '@ork-orm/schema-parser',
    '@ork-orm/client',
    'vite',
    'webpack',
    'rollup',
    'esbuild',
  ],
})
