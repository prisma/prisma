# Usage with module bundlers

_Module bundlers_ bundle JavaScript modules into a single JavaScript file. Most bundlers work by copying over the JavaScript code from a variety of source files into the target file. 

Since Prisma Client JS is not only based on JavaScript code, but also relies on the **query engine binary** to be available, you need to make sure that your bundled code has access to the binary.

To do so, you can use plugins that let you copy over static assets:

| Bundler | Plugin |
| :-- | :-- |
| Webpack | [`copy-webpack-plugin`](https://github.com/webpack-contrib/copy-webpack-plugin#copy-webpack-plugin) |
| Parcel | [`parcel-plugin-static-files-copy`](https://github.com/elwin013/parcel-plugin-static-files-copy#readme) |