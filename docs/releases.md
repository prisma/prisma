# Release process

This page explains the release process for Prisma 2.

## Release log

You can find all previous releases of Prisma 2 [here](https://github.com/prisma/prisma2/releases). Note that the versioining scheme has been adjusted with the [`2.0.0-preview014`](https://github.com/prisma/prisma2/releases/tag/2.0.0-preview014) release to fully comply to the [semver](https://semver.org/) spec.

## Release channels

There are two main release channels:

- **Preview**: Biweekly releases on Thursdays
- **Alpha**: Rolling/continuous releases

Unless you have specific requirements for the Alpha channel, it is recommended to always use the latest Preview release.

### Preview

The Prisma Frameowrk follows a **biweekly release cycle** where new Preview releases are typically issued **on Thursdays** (but might be delayed). 

Preview releases are named `2.0.0-preview014`, `2.0.0-preview015`, `2.0.0-preview016`, ... or you can reference them for short: `preview014`, `preview015`, `preview016` ...

You can install the latest Preview release via npm:

```
npm install -g prisma2
```

Note that Prisma 2 CLI currently requires [Node 8](https://nodejs.org/en/download/releases/) (or higher). It also executes a [`postinstall`](./prisma2-cli.md#the-postinstall-hook) hook.


### Alpha (latest)

The Alpha channel contains the latest changes to Prisma 2. Because it's is based on the [`alpha`](https://github.com/prisma/prisma2/tree/alpha) development branch, it's more likely that things break or behave unexpectedly in an Alpha release.

You should only use Alpha releases if you have specific requirements that are not met by the current Preview release.

You can install the latest Alpha release via npm:

```
npm install -g prisma2@alpha
```
