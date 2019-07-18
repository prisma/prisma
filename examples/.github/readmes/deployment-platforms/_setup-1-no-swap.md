When deploying on this platform, the build is created on the server and hence the correct binary is available as `prisma2 generate` runs on the server. 

Hence, we do not need to provide additional platform targeting options like `platforms` and `pinnedPlatform`. With no additional parameters necessary, the generate section of the Prisma schema file looks like 

```
generator photon {
    provider = "photonjs"
}
```