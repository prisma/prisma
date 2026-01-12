import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['kysely', '@ork/schema-parser'],
  minify: false,
  splitting: false,
  bundle: true,
})
