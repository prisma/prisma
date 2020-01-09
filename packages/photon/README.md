# @prisma/photon

This package is being used by `prisma2`.

## Contributing

### Getting a local test version running

1. Clone this repo
2. `cd photonjs/packages/photon`
3. `yarn`
4. `ts-node fixtures/generate.ts ./fixtures/blog/`
5. `cd fixtures/blog`
6. `prisma2 lift save --name init && prisma2 lift up`
7. `ts-node main.ts`

### Working on code generation

If you have your local blog example running, you can now just do changes to `TSClient.ts` and re-execute `npx ts-node fixtures/generate.ts ./fixtures/blog/`.

### Working with the runtime

If you want to use the local runtime in the blog example, just run

```
ts-node fixtures/generate.ts ./fixtures/blog/ --local-runtime
```

Changes to `query.ts` will then be reflected when running `fixtures/blog/main.ts`
