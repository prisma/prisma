# AWS Lambda with Serverless

## Deployment

When deploying on this platform, the build is created on the local development machine (unless you are using a CI) and hence we need to swap the binaries by using additional platform targeting options like `platforms`. With these additional parameters, the generate section of the Prisma schema file looks like 

```
generator photon {
    provider       = "photonjs"
    platforms      = ["native", "linux-glibc-libssl1.0.1"]
}
```

To know the platform identifiers, please refer to [this](https://github.com/prisma/specs/tree/master/binaries#table-of-binaries). 

Note that this setup will increase the bundle size as you would also bundle the local binary while creating the bundle for deployment platform. Please refer to the "Ignore Files from Bundle" section for more details of how that situation can be avoided. 

## Environment

Deploying to this platform requires setting up the production environment variables correctly. Please refer to the following section to find out how that can be done

https://serverless.com/framework/docs/providers/aws/guide/variables/#referencing-environment-variables

## Ignore Files from Bundle

The development/deployment configuration for this platform causes extra binary to be packaged that is not required, please refer to this section of the platform docs to ignore the binary used while developing locally. 

https://serverless.com/framework/docs/providers/aws/guide/packaging/