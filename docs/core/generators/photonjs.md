# Photon JS generator

The Photon JS generator can be used in a [Prisma schema file](../../prisma-schema-file.md) to generate the Photon database client for Node.js and TypeScript. The API of the generated client is documented [here](../../photon/api.md).

## Target

The `photonjs` generator targets [ES2016](https://exploringjs.com/es2016-es2017/) & [Node.js 8.x +](https://nodejs.org/en/download/releases/).

## Example

To invoke the generator, you need to add a [`generator`](../../prisma-schema-file.md#generators-optional) block to your schema file and specify the `photon-js` provider:

```groovy
generator js {
  provider = "photonjs"
  output   = "./generated/photon"
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
