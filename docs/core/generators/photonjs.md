# Photon JS generator

The Photon JS generator can be used in a [Prisma schema file](../../prisma-schema-file.md) to generate the Photon database client for Node.js and TypeScript. The API of the generated client is documented [here](../../photon/api.md).

## Node.js requirements

The `photonjs` generator targets [ES2016](https://exploringjs.com/es2016-es2017/) & [Node.js 8.x +](https://nodejs.org/en/download/releases/). 

## Compilation target (query engine)

Photon JS depends on a query engine that's running as a binary right next to your application. You can set the compilation target of the binary by adding the `target` field to the `photonjs` generator block:

```prisma
generator photonjs {
  provider = "photonjs"
  target   = "darwin"
}
```

Note that `darwin` is the default `target`. Here's a list of supported platforms and their targets:

|  **Platform** | **Target** | 
| :---:  | :---: |
| Mac OS | `darwin` (default) |
| Ubuntu, Centos, CodeSandbox	  | `linux-glibc` |
| Alpine | `linux-musl` |
| Windows  | `windows` |
| Lambda Node 8, ZEIT Now | `linux-glibc-libssl1.0.1` |
| Lambda Node 10  | `linux-glibc-libssl1.0.2` |
| Heroku | _coming soon_ |
| Cloudflare Workers | _coming soon_ |
| Google Cloud Functions | User's choice |


Therefore, when deploying your Photon-based application to production, you need to ensure that you're specifying the right _compilation target_ for the binary.

You can customize the compilation target by adjusting the 

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

The Photon JS generator provides the following mapping from data model [scalar types](../../data-modeling.md#scalar-types) to JavaScript/TypeScript types:

| Type     | JS / TS | 
| -------- | ------- |
| `String`   | `string`  |
| `Boolean`  | `boolean` |
| `Int`      | `number`  |
| `Float`    | `number`  |
| `Datetime` | `Date`    |
