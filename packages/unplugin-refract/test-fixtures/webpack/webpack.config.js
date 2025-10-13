const path = require('path')
const RefractPlugin = require('unplugin-refract/webpack')

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    new RefractPlugin({
      schema: '../schema.prisma',
      debug: true,
      production: {
        optimize: process.env.NODE_ENV === 'production',
        cache: true,
        failOnError: process.env.NODE_ENV === 'production',
      },
    }),
  ],
  devtool: 'source-map',
}
