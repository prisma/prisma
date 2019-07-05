# Deployment

Photon JS depends on a query engine that's running as a binary right next to your application. This binary needs to be executable in your production environment. 

Therefore, when deploying your Photon-based application to production, you need to ensure that you're specifying the right [_compilation target_](../core/generators/photonjs.md#compilation-target-query-engine) for the binary.

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
