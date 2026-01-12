import ork from 'unplugin-ork/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    ork({
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
