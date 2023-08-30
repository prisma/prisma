# Prisma Webpack Plugin

Ensures that your Prisma files are copied.

## Next.js

```js
const { PrismaPlugin } = require('@prisma/nextjs-monorepo-workaround-plugin')

module.exports = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()]
    }

    return config
  },
}
```

## Webpack

```js
const { PrismaPlugin } = require('@prisma/nextjs-monorepo-workaround-plugin')

module.exports = {
  plugins: [new PrismaPlugin()],
}
```
