# Deployment

Photon JS depends on a query engine that's running as a binary right next to your application. This binary needs to be executable in your production environment. 

Therefore, when deploying your Photon-based application to production, you need to ensure that you're specifying the right [compilation target](../core/generators/photonjs.md#compilation-target-query-engine) for the binary.

You can determine the compilation target of the binary by adding the `target` field to the `photonjs` generator block:

```prisma
generator photonjs {
  provider = "photonjs"
  target   = "darwin"
}
```

Note that `darwin` is the default `target`. Here's a list of supported platforms and their targets:

|  **Platform** | **Target** | 
| :---  | :--- |
| Mac OS | `darwin` (default) |
| Ubuntu <br /> Centos <br /> CodeSandbox	  | `linux-glibc` |
| Alpine | `linux-musl` |
| Windows  | `windows` |
| Lambda Node 8 <br /> ZEIT Now | `linux-glibc-libssl1.0.1` |
| Lambda Node 10  | `linux-glibc-libssl1.0.2` |
| Heroku | _coming soon_ |
| Cloudflare Workers | _coming soon_ |
| Google Cloud Functions | User's choice |

> **ATTENTION**: The `target` field on the `generator` block is not yet implemented. You can track the progress of the implementation [on GitHub](https://github.com/prisma/prisma2/issues/97). You can also check ou the [specification](https://github.com/prisma/specs/tree/master/binary-workflows) for more details.

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