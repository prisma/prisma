#!/bin/bash

set -ex

# Run prisma2 tests
cd prisma2
yarn || echo ""
yarn ncc:download
yarn
yarn update-deps
yarn test

# Run @prisma/introspection tests
cd ../introspection
yarn
yarn update-deps
yarn build
yarn test