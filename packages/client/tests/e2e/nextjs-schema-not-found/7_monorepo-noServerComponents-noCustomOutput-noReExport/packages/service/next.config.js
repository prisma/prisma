const path = require('path')

/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  experimental: {
    // outputFileTracingRoot: path.join(__dirname, '../../'),
  },
}
