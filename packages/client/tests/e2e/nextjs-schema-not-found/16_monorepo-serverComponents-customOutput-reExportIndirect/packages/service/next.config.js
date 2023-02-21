const { PrismaPlugin } = require('experimental-prisma-webpack-plugin')

/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  experimental: {
    appDir: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()]
    }

    return config
  },
}
