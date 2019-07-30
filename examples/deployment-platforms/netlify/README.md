# Netlify

## Deployment

```bash
yarn install
yarn deploy
```

When deploying on this platform, the build is created on the local development machine (unless you are using a CI) and hence we need to swap the binaries by using additional platform targeting options like `platforms`. With these additional parameters, the generate section of the Prisma schema file looks like 

```
generator photon {
    provider       = "photonjs"
    platforms      = ["native", "linux-glibc-libssl1.0.1"]
}
```

To know the platform identifiers, please refer to [this](https://github.com/prisma/specs/tree/master/binaries#table-of-binaries). 

Note that this setup will increase the bundle size as you would also bundle the local binary while creating the bundle for deployment platform. Please refer to the "Ignore Files from Bundle" section for more details of how that situation can be avoided. 

This platform requires us to create the bundle of deployment manually as a `zip` file. To make deployment easy, we generate Photon outside of `node_modules` into a common folder (say `functions`) that can be zipped before deployment. With this requirement, the generate section of the Prisma schema file looks like 

```
generator photon {
    provider       = "photonjs"
    output         = "./functions/generated/photon"
```

## Environment

Deploying to this platform requires setting up the production environment variables correctly. Please refer to the following section to find out how that can be done

https://www.netlify.com/docs/continuous-deployment/#environment-variables

## Ignore files from bundling

The development/deployment configuration for this platform causes extra binary to be packaged that is not required, please refer to this section of the platform docs to ignore the binary used while developing locally. 

Since for Netlify, we are bundling manually, we can remove the local binary before creating the zip bundle for deployment. 