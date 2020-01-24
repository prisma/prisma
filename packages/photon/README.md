# @prisma/client

This package is being used by `prisma2`.

## Contributing

### Getting a local test version running

1. Clone this repo
2. `cd prisma-client-js/packages/photon`
3. `yarn`
4. `ts-node fixtures/generate.ts ./fixtures/blog/ --skip-transpile`
5. `cd fixtures/blog`
6. `prisma2 migrate save --name init --experimental && prisma2 migrate up --experimental`
7. `ts-node main.ts`

### Working on code generation

If you have your local blog fixture running, you can now do changes to `TSClient.ts` and re-execute `npx ts-node fixtures/generate.ts ./fixtures/blog/`.

When doing changes and working on a fixture use `yarn build && rm -rf fixtures/blog/node_modules/ && ts-node fixtures/generate.ts fixtures/blog`

### Working with the runtime

If you want to use the local runtime in the blog fixture, run

```sh
ts-node fixtures/generate.ts ./fixtures/blog/ --local-runtime
```

Changes to `query.ts` will then be reflected when running `fixtures/blog/main.ts`
