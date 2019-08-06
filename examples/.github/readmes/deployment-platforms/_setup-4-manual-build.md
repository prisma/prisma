This platform requires us to create the bundle of deployment manually as a `zip` file. To make deployment easy, we generate Photon outside of `node_modules` into a common folder (say `functions`) that can be zipped before deployment. With this requirement, the generate section of the Prisma schema file looks like 

```
generator photon {
    provider       = "photonjs"
    output         = "./functions/generated/photon"
```