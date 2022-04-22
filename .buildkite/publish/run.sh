#!/bin/bash

set -ex

npm i --silent -g pnpm@6 --unsafe-perm # TODO: is this unsafe-perm needed?

pnpm i

pnpm run lint

node -v
npm -v

pnpm run setup

# TODO: why is this necessary?
cd packages/integration-tests
pnpm i sqlite3@5.0.2 --unsafe-perm --reporter=silent
cd ../..

pnpm run test && pnpm run test:functional -r --if-present

# disable printing with +x and return as before just after
set +x
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
set -ex

pnpm run publish-all
