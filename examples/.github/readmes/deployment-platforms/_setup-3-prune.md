Post the deploy step, this platform prunes the "node_modules". Pruning is a process where `node_modules` are matched to the packages in `package.json` file. 

Since we generate Photon in `node_modules` in `@generated/photon` and this is not available in `package.json`, it gets removed. As a workaround, we need to move Photon out of `node_modules` into a custom directory. With this requirement, the generate section of the Prisma schema file looks like 

```
generator photon {
    provider       = "photonjs"
    output         = "./generated/photon"
```