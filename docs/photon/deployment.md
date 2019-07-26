# Deployment

Photon JS depends on a query engine that's running as a binary on the same host as your application. When deploying your Photon-based application to production, you need to ensure that the binary used by Photon can run in your production environment, i.e. it needs to be compatible with the runtime of your deployment provider.

The query engine binary is downloaded when you run `prisma2 generate`, it is then stored alongside the generated Photon code inside `node_modules/@generated` (or the [custom `output` path](./codegen-and-node-setup.md) you specified). 

**IMPORTANT**: To ensure the query engine binary is compatible with your production environment, you have to [specify the right platform for Photon JS](../core/generators/photonjs.md#specifying-the-right-platform-for-photon-js).

## Hosting providers

### ZEIT Now

You can deploy your "Photon JS"-based application to [ZEIT Now](https://zeit.co/now).

When deploying to ZEIT Now, you must configure the following in your `now.json`:

- `use`: `@now/node@canary`
- `maxLambdaSize`: `25mb`

Here is an example `now.json`:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.js",
      "use": "@now/node@canary",
      "config": {
        "maxLambdaSize": "25mb"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "index.js"
    }
  ]
}
```

You can find an example for a ZEIT Now deployment [here](https://github.com/prisma/photonjs/tree/master/examples/javascript/now). 
