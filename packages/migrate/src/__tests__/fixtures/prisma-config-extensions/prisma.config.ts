import { defineConfig } from '@prisma/config/src'

export default defineConfig({
  experimental: {
    extensions: true,
  },
  extensions: [
    {
      types: [
        {
          prismaName: 'Vector3',
          dbName: 'vector',
          dbTypeModifiers: ['3'],
          numberOfDbTypeModifiers: 1,
        },
      ],
    },
  ],
})
