const path = require('path')
// const Plugin = require('typescript-declaration-webpack-plugin')

module.exports = {
  entry: './src/runtime/browser.ts',
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
      chalk: path.resolve(__dirname, 'dist/runtime/browser-chalk.js'),
    },
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'browser-runtime'),
  },
  optimization: {
    minimize: false,
  },
  // plugins: [
  //   new Plugin({
  //     // moduleName: './src/runtime/browser.ts',
  //     out: path.resolve(__dirname, 'webpack-browser/main.d.ts'),
  //   }),
  // ],
}
