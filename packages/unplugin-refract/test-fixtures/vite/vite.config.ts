import refract from 'unplugin-refract/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    refract({
      schema: '../schema.prisma',
      debug: true,
      production: {
        optimize: true,
        cache: true,
        sourceMaps: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': './src',
    },
  },
})
