# Photon.js generator

The Photon.js generator can be used in a [Prisma schema file](../../prisma-schema-file.md) to generate the Photon database client for Node.js and TypeScript. The API of the generated client is documented [here](../../photon/api.md).

## Node.js requirements

The generated data access code of the `photonjs` generator targets [ES2016](https://exploringjs.com/es2016-es2017/) which means you need [Node.js 8.x](https://nodejs.org/en/download/releases/) or newer to be able to use it.

## Specifying the right platform for Photon.js

Photon.js depends on a _query engine_ that's running as a _binary_ on the same host as your application. When deploying your Photon-based application to production, you need to ensure that the binary used by Photon can run in your production environment, i.e. it needs to be compatible with the runtime of your deployment provider.

The query engine binary is downloaded when you run `prisma2 generate`, it is then stored alongside the generated Photon code inside `node_modules/@generated` (or the [custom `output` path](../../photon/codegen-and-node-setup.md) you specified). This section explains how you can determine which binary should be downloaded when `prisma2 generate` is executed to ensure compatibility at runtime.

You can read more about this topic in the [specification](https://github.com/prisma/specs/blob/master/binaries/Readme.md).

### Terminology

A **platform** is a _managed environment_. This includes deployment providers such as AWS Lambda, Google Cloud Functions and Netlify as well as operating systems such as Mac OS and Windows. A platform represents a _runtime environment_, i.e. the concrete version of the operating system and the installed packages available at runtime.

### Generator options

To determine the platform Photon is running on, you can provide two options to the `photonjs` generator:

| Name             | Required                                               | Description                                                                                                                                                                                                                | Purpose                                                   |
| ---------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `platforms`      | No                                                     | An array of binaries that are required by the application. Either a _file path_ to a binary, a package name from the [available binaries](#available-binaries) or the special value `"native"`. **Default**: `["native"]`. | Declarative way to download the required binaries.        |
| `pinnedPlatform` | Only if `platforms` contains a _file path_ to a binary | A string that points to the name of an object in the `platforms` field (typically an environment variable). Requires the `platforms` options to be a non-empty array.                                                      | Declarative way to define which binary to use at runtime. |

### Default: The `native` platform

When no [generator options](#generator-options) are passed to the `photonjs` generator in your [Prisma schema file](../prisma-schema-file.md), the Prisma CLI will download the binary for the operating system on which `prisma2 generate` was executed. The following two configurations are therefore equivalent, because `["native"]` is the default value for `platforms`:

```prisma
generator photon {
  provider = "photonjs"
  platforms = ["native"]
}
```

has the **same behaviour** as:

```prisma
generator photon {
  provider = "photonjs"
}
```

In both cases, the Prisma CLI determines the current operating system where `prisma2 generate` was invoked and downloads the compatible binary to store it in `node_modules`.

### Available binaries

| Package                 | Known Platforms     | Needs `libssl`? | Query Engine                                                                                                                        | Migration Engine                                                                                                                            | Prisma Format                                                                                                     |
| ----------------------- | ------------------- | :-------------: | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| darwin                  | (Local development) |                 | [prisma-query-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/darwin/prisma-query-engine.gz)                  | [prisma-migration-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/darwin/prisma-migration-engine.gz)                  | [prisma-fmt](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/darwin/prisma-fmt.gz)                  |
| windows                 | (Local development) |                 | [prisma-query-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/windows/prisma-query-engine.gz)                 | [prisma-migration-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/windows/prisma-migration-engine.gz)                 | [prisma-fmt](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/windows/prisma-fmt.gz)                 |
| linux-glibc-libssl1.0.1 | Lambda Node 8, ZEIT |        ✓        | [prisma-query-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-glibc-libssl1.0.1/prisma-query-engine.gz) | [prisma-migration-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-glibc-libssl1.0.1/prisma-migration-engine.gz) | [prisma-fmt](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-glibc-libssl1.0.1/prisma-fmt.gz) |
| linux-glibc-libssl1.0.2 | Lambda (Node 10)    |        ✓        | [prisma-query-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-glibc-libssl1.0.2/prisma-query-engine.gz) | [prisma-migration-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-glibc-libssl1.0.2/prisma-migration-engine.gz) | [prisma-fmt](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-glibc-libssl1.0.2/prisma-fmt.gz) |
| linux-glibc-libssl1.1.0 | ?                   |        ✓        | [prisma-query-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-glibc-libssl1.1.0/prisma-query-engine.gz) | [prisma-migration-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-glibc-libssl1.1.0/prisma-migration-engine.gz) | [prisma-fmt](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-glibc-libssl1.1.0/prisma-fmt.gz) |
| linux-glibc-libssl1.1.1 | ?                   |        ✓        | [prisma-query-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-glibc-libssl1.1.1/prisma-query-engine.gz) | [prisma-migration-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-glibc-libssl1.1.1/prisma-migration-engine.gz) | [prisma-fmt](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-glibc-libssl1.1.1/prisma-fmt.gz) |
| linux-musl-libssl1.0.1  | Alpine              |        ✓        | [prisma-query-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-musl-libssl1.0.1/prisma-query-engine.gz)  | [prisma-migration-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-musl-libssl1.0.1/prisma-migration-engine.gz)  | [prisma-fmt](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-musl-libssl1.0.1/prisma-fmt.gz)  |
| linux-musl-libssl1.0.2  | Alpine              |        ✓        | [prisma-query-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-musl-libssl1.0.2/prisma-query-engine.gz)  | [prisma-migration-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-musl-libssl1.0.2/prisma-migration-engine.gz)  | [prisma-fmt](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-musl-libssl1.0.2/prisma-fmt.gz)  |
| linux-musl-libssl1.1.0  | Alpine              |        ✓        | [prisma-query-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-musl-libssl1.1.0/prisma-query-engine.gz)  | [prisma-migration-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-musl-libssl1.1.0/prisma-migration-engine.gz)  | [prisma-fmt](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-musl-libssl1.1.0/prisma-fmt.gz)  |
| linux-musl-libssl1.1.1  | Alpine              |        ✓        | [prisma-query-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-musl-libssl1.1.1/prisma-query-engine.gz)  | [prisma-migration-engine](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-musl-libssl1.1.1/prisma-migration-engine.gz)  | [prisma-fmt](https://s3-eu-west-1.amazonaws.com/prisma-native/alpha/latest/linux-musl-libssl1.1.1/prisma-fmt.gz)  |

### Example

This example shows the configuration of a Photon.js generator for local development (`native` can resolve to any other platform) and AWS Lambda (Node 10) as the production environment.

```prisma
generator photon {
    provider = "photonjs"
    platforms = ["native", "linux-glibc-libssl1.0.2"] // For Lambda (Node 10)
    pinnedPlatform = env("PLATFORM")                  // Local: "native"; In production: "linux-glibc-libssl1.0.2"
}
```

## Manually compiling the query engine binary

If a binary is not available for the platform you want to target, it is possible to compile the Prisma binaries on that platform manually. To compile a binary manually, please follow these steps:

1. Download the Rust toolchain: https://www.rust-lang.org/tools/install
1. Clone https://github.com/prisma/prisma
1. Switch to `alpha` branch (during the preview period, we are using the `alpha` branch)
1. Change the directory to `prisma/server/prisma-rs`
1. Run `cargo build --release`
1. The binaries should be available in the `prisma/server/prisma-rs/target/release` folder, the name of the query engine binary is `prisma` and the migration engine binary is `migration-engine`.

## Example

To invoke the generator, you need to add a [`generator`](../../prisma-schema-file.md#generators-optional) block to your schema file and specify the `photonjs` provider:

```prisma
generator js {
  provider = "photonjs"
}

// ... the file should also contain connectors and a data model definition
```

Once added, you can invoke the generator using the following command:

```
prisma2 generate
```

It will then store the generated Photon API in the specified `./generated/photon` directory. Learn more about the [generated Photon API](../../photon/api.md).

## Mapping types from the data model

The Photon.js generator provides the following mapping from data model [scalar types](../../data-modeling.md#scalar-types) to JavaScript/TypeScript types:

| Type       | JS / TS   |
| ---------- | --------- |
| `String`   | `string`  |
| `Boolean`  | `boolean` |
| `Int`      | `number`  |
| `Float`    | `number`  |
| `Datetime` | `Date`    |

## Reserved model names

When generating Photon.js based on your [data model definition](./data-modeling.md#data-model-definition), there are a number of reserved names that you can't use for your models. Here is a list of the reserved names:

- `String`
- `Int`
- `Float`
- `Subscription`
- `DateTime`
- `WhereInput`
- `IDFilter`
- `StringFilter`
