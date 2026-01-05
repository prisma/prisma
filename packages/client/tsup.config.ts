import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['@refract/schema-parser', 'kysely'],
  minify: false,
  splitting: false,
  bundle: true,
})
