# Google Cloud Functions

## Deployment

When deploying on this platform, the build is created on the server and hence the correct binary is available as `prisma2 generate` runs on the server. 

Hence, we do not need to provide additional platform targeting options like `platforms`. With no additional parameters necessary, the generate section of the Prisma schema file looks like 

```
generator photon {
    provider = "photonjs"
}
```

## Environment

Deploying to this platform requires setting up the production environment variables correctly. Please refer to the following section to find out how that can be done

https://cloud.google.com/functions/docs/env-var