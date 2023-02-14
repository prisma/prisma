const { PrismaPlugin } = require('experimental-prisma-webpack-plugin')

/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()]
    }

    return config
  },
}
