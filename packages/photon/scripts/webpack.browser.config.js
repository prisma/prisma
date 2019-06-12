const path = require('path')

const entry = path.resolve(__dirname, '../src/runtime/browser.ts')

module.exports = {
  entry,
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  externals: {
    path: 'path',
    fs: 'fs',
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      chalk: path.resolve(__dirname, '../dist/runtime/browser-chalk.js'),
      ['terminal-link']: path.resolve(__dirname, '../dist/runtime/browser-terminal-link.js'),
    },
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, '../browser-runtime'),
    library: 'photon-generate',
    libraryTarget: 'umd',
  },
  optimization: {
    minimize: false,
  },
}
