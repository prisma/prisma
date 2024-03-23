# Prisma Client Test on Windows

```
Tests were created to check if Prisma Client is installed properly on Windows.
On Windows, Prisma Client is unable to resolve packages and paths automatically compared to other environments when using Yarn. This results in a "Could not resolve @prisma/client..." error. Meaning that the client is unable to find the `@prisma/client` or resolve the path to or packages for `@prisma/client`.

Thus, Windows users must manually check if both the packages and `@prisma/client` are installed properly in order to successfully run the client.
```
