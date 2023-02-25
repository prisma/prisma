const { PrismaPlugin } = require('@prisma/nextjs-monorepo-workaround-plugin')

/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  experimental: {
    appDir: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer && process.env.WORKAROUND === 'true') {
      config.plugins = [...config.plugins, new PrismaPlugin()]
    }

    return config
  },
}
