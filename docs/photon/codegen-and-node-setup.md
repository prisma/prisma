# Code generation & Node.js setup

## TLDR

Photon.js is generated into `node_modules/@generated` by default. While this approach has a number of [benefits](#why-is-photon-js-generated-into-node_modulesgenerated-by-default), it is also unconventional and can be a source confusion for developers new to Photon.js.

Using `node_modules/@generated` as the default `output` for Photon.js is still experimental. Please share your feedback and tell us whether you think this is a good idea or any other thoughts you have on this topic by joining the [discussion on GitHub](https://github.com/prisma/photonjs/issues/88).

## Overview

`prisma2 generate` uses the [generators](../prisma-schema-file.md#generators-optional) specified in the [Prisma schema file](../prisma-schema-file.md) and generates the respective packages on the respective output path(s).

The default Photon.js generator can be specified as follows in your schema file:

```prisma
generator photonjs {
  provider = "photonjs"
}
```

Note that this is equivalent to specifying the default `output` path:

```prisma
generator photonjs {
  provider = "photonjs"
  output   = "node_modules/@generated/photon"
}
```

When running `prisma2 generate` for either of these schema files, the `photon` package will be located in:

```
node_modules/@generated/photon
```

## Photon.js should be viewed as an npm package

Node.js libraries are typically installed as npm dependencies using `npm install`. The respective packages are then located inside the [`node_modules`](https://docs.npmjs.com/files/folders#node-modules) directory from where they can be imported into application code.

Because Photon.js is a custom API for _your_ specific database setup, it can't follow that model. It needs to be generated locally instead of being installed from a central repository like npm. However, the mental model for Photon.js should still be that of an Node module.

## Why is Photon.js generated into `node_modules/@generated` by default?

### One-line imports

By generating Photon.js into `node_modules/@generated`, you can import it into your code:

```js
import { Photon } from '@generated/photon'
```

or

```js
const { Photon } = require('@generated/photon')
```

### Keeping the query engine binary out of version control by default

Photon.js is based on a query engine that's running as a binary alongside your application. This binary is downloaded when `prisma2 generate` is invoked initially and stored in the `output` path (right next to the generated Photon API).

By generating Photon.js into `node_modules`, the query engine is kept out of version control by default (since `node_modules` is typically ignored for version control). If it was not generated into `node_modules`, then developers would need to explicitly ignore it, e.g. for Git they'd need to add the `output` path to `.gitignore`.

## Generating Photon.js in `postinstall` hook

Generating Photon.js into `node_modules` has the potential problem that package managers like `npm` or `yarn` want to maintain the integrity of `node_modules`. They therefore remove any additional folders that are not specified by the respective `.lock` files on operations like `install`, `add`, etc.

To work around this problem, you can add a `postinstall` script to your `package.json`. This gets invoked automatically after any time invocation of `npm install`:

```json
{
  "scripts": {
    "postinstall": "prisma2 generate"
  }
}
```

When collaborating on a project that uses Photon.js, this approach allows for conventional Node.js best practices where a team member can clone a Git repository and then run `npm install` to get their version of the Node dependencies inside their local `node_modules` directory.

However, the downside of this approach is that when developers have _not_ configured a `postinstall` script for the generation of Photon.js and are not aware that they must generate Photon.js after cloning a repository, they will most likely run into errors and be confused.
