# Release process

This page explains the release process for Prisma 2.

## Release log

- [`preview-1`](https://github.com/prisma/prisma2/releases/tag/2.0.0-preview-1) (July 11, 2019)
- [`preview-2`](https://github.com/prisma/prisma2/releases/tag/2.0.0-preview-2) (July 18, 2019) 
- [`preview-3`](https://github.com/prisma/prisma2/releases/tag/2.0.0-preview-3) (July 26, 2019; DELAYED) 
- [`preview-5`](https://github.com/prisma/prisma2/releases/tag/2.0.0-preview-5) (August 2, 2019; DELAYED)
- [`preview-6`](https://github.com/prisma/prisma2/releases/tag/2.0.0-preview-6) (August 8, 2019)

## Release channels

There are two main release channels:

- **Preview**: Weekly releases on Thursdays
- **Alpha**: Rolling/continuous releases

Unless you have specific requirements for the alpha channel, it is recommended to always use the latest Preview release.

### Preview

Prisma 2 has a **weekly release cycle** where new Preview releases are typically issued **on Thursdays** (but might be delayed). 

Preview releases are named `2.0.0-preview-1`, `2.0.0-preview-2`, `2.0.0-preview-3`, ... or you can reference them for short: `preview-1`, `preview-2`, `preview-3` ...

You can install the latest Preview release via npm:

```
npm install -g prisma2
```

### Alpha (latest)

The alpha channel contains the latest changes to Prisma 2. Because alpha is based on a development branch, it's more likely that things break or behave unexpectedly in an alpha release.

You should only use alpha releases if you have specific requirements that are not met by the latest Preview release.

You can install the latest alpha release via npm:

```
npm install -g prisma2@alpha
```
