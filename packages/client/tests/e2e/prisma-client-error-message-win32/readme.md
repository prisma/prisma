#Prisma Client Test for Windows Environment

```
Tests were created to check if the prisma client is installed properly for the Windows environment.
For the Windows environments, the prisma client is unable to resolve packages and paths automatically compared to other environments when using Yarn. This results in a "Could not resolve @prisma/client..." error. Meaning that the client is unable to find the @prisma/client or resolve the path to or packages for the @prisma/client.

Thus, Windows users must manually check if both the packages and @prisma/client are installed properly in order to successfully run the client.
```
