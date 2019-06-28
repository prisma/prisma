#!/bin/bash

set -ex
env

# Run prisma2 tests
cd prisma2
yarn
yarn update-deps
yarn test

# Run @prisma/introspection tests
cd ../introspection
yarn
yarn update-deps
yarn build
yarn test