import { defineConfig } from '@prisma/config/src'
export default defineConfig({
  datasource: {
    url: process.env.TEST_POSTGRES_URI_MIGRATE,
  },
  engine: 'classic',
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
