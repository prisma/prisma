# Prisma Client JS generator

The Prisma Client JS generator can be used in a [Prisma schema file](../../prisma-schema-file.md) to generate Prisma's database client for Node.js and TypeScript. The API of Prisma Client JS is documented [here](../../prisma-client-js/api.md).

## Node.js requirements

The generated data access code of the `prisma-client-js` generator targets [ES2016](https://exploringjs.com/es2016-es2017/) which means you need [Node.js 10.x](https://nodejs.org/en/download/releases/) or newer to be able to use it.

## Specifying the right platform for Prisma Client JS

Prisma Client JS depends on a _query engine_ that's running as a _binary_ on the same host as your application. When deploying your Prisma-based application to production, you need to ensure that the binary used by Prisma Client JS can run in your production environment, i.e. it needs to be compatible with the runtime of your deployment provider.

The query engine binary is downloaded when you run `prisma2 generate`, it is then stored alongside the generated Prisma Client JS code inside `node_modules/@prisma` (or the [custom `output` path](../../prisma-client-js/codegen-and-node-setup.md) you specified). This section explains how you can determine which binary should be downloaded when `prisma2 generate` is executed to ensure compatibility at runtime.

You can read more about this topic in the [specification](https://github.com/prisma/specs/blob/master/binaries/Readme.md).

### Terminology

A **platform** is a _managed environment_. This includes deployment providers such as AWS Lambda, Google Cloud Functions and Netlify as well as operating systems such as Mac OS and Windows. A platform represents a _runtime environment_, i.e. the concrete version of the operating system and the installed packages available at runtime.

### Generator options

To determine the platform Prisma Client JS is running on, you can provide two options to the `prisma-client-js` generator:

| Name             | Required                                               | Description                                                                                                                                                                                                                | Purpose                                                   |
| ---------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `binaryTargets`      | No                                                     | An array of binary names that are required by the application. Either a _file path_ to a binary, a package name from the [available binaries](#available-binaries) or the special value `"native"`. **Default**: `["native"]`. | Declarative way to download the required binaries.        |

If `binaryTargets` contains a _file path_ to a binary, you need to provide the path to the binary via an environment variable:

- If you're using a custom binary for the **query engine** (Prisma Client JS), set the file path to it as the `PRISMA_QUERY_ENGINE_BINARY` environment variable.
- If you're using a custom binary for the **migration engine**, set the file path to it as the `PRISMA_MIGRATION_ENGINE_BINARY` environment variable.

### Default: The `native` platform

When no [generator options](#generator-options) are passed to the `prisma-client-js` generator in your [Prisma schema file](../prisma-schema-file.md), the Prisma CLI will download the binary for the operating system on which `prisma2 generate` was executed. The following two configurations are therefore equivalent, because `["native"]` is the default value for `binaryTargets`:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native"]
}
```

has the **same behavior** as:

```prisma
generator client {
  provider = "prisma-client-js"
}
```

In both cases, the Prisma CLI determines the current operating system where `prisma2 generate` was invoked and downloads the compatible binary to store it in `node_modules`.

### Available binaries

We provide various pre-built binaries. You can find them in the [specs binary table](https://github.com/prisma/specs/blob/master/binaries/Readme.md#binary-build-targets).

### Example

This example shows the configuration of a Prisma Client JS generator for local development (`native` can resolve to any other platform) and AWS Lambda (Node 10) as the production environment.

```prisma
generator client {
    provider = "prisma-client-js"
    binaryTargets = ["native", "debian-openssl-1.0.x"] 
}
```

## Manually compiling the query engine binary

You can find the instructions for manually compiling the query engine binary [here](https://github.com/prisma/prisma-engine#building-prisma-engines).

## Example

To invoke the generator, you need to add a [`generator`](../../prisma-schema-file.md#generators-optional) block to your schema file and specify the `prisma-client-js` provider:

```prisma
generator client {
  provider = "prisma-client-js"
}

// ... the file should also contain connectors and a data model definition
```

Once added, you can invoke the generator using the following command:

```
prisma2 generate
```

It will then store the generated Prisma Client JS API in the default location `node_modules/@prisma/client` directory. Learn more about the [generated Prisma Client JS API](../../prisma-client-js/api.md).

## Mapping types from the data model

The Prisma Client JS generator provides the following mapping from data model [scalar types](../../data-modeling.md#scalar-types) to JavaScript/TypeScript types:

| Type       | JS / TS   |
| ---------- | --------- |
| `String`   | `string`  |
| `Boolean`  | `boolean` |
| `Int`      | `number`  |
| `Float`    | `number`  |
| `DateTime` | `Date`    |

## Reserved model names

When generating Prisma Client JS based on your [data model definition](./data-modeling.md#data-model-definition), there are a number of reserved names that you can't use for your models. Here is a list of the reserved names:

- `String`
- `Int`
- `Float`
- `Subscription`
- `DateTime`
- `WhereInput`
- `IDFilter`
- `StringFilter`
