const path = require('path')

module.exports = {
  entry: path.resolve(__dirname, '../src/runtime/browser.ts'),
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      chalk: path.resolve(__dirname, '../dist/runtime/browser-chalk.js'),
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
