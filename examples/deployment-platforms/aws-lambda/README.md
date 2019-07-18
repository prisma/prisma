### Introduction

Testing Prisma 2 with lambda (using serverless framework)

1. `yarn dev` local development
2. `yarn deploy` deploy to lambda

Notes:

1. Dev machine is MacOS, build target is Linux (Lambda) - resolved via Photon constructor `__internal` option.
2. Bug in generation writes an absolute path for `cwd`, `__internal` option can be used to override `cwd`. (TODO: Create an issue for this)
3. Binary resolution is not transparent currently, lazy downloading per request might be slow. Resolved by including both binaries in the source control and using an env var + `__internal` option to resolve the correct binary and per stage environment for development workflow.
4. Requests are slow as engine starts / request. 

P.S. `__internal` option is not for public use.
