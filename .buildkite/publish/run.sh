#!/bin/bash

set -ex

npm i --silent -g pnpm@6 --unsafe-perm # TODO: is this unsafe-perm needed?

pnpm i

node -v
npm -v

pnpm run setup

# TODO: why is this necessary?
# cd packages/integration-tests
# pnpm i sqlite3@5.0.2 --unsafe-perm --reporter=silent
# cd ../..

# New client test suite
pnpm run test:functional --filter "@prisma/client"

# Run test for all packages
pnpm run test

# disable printing with +x and return as before just after
set +x
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
set -ex

pnpm run publish-all
