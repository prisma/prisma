#!/bin/bash

set -ex
env

# Wait for Postgres
export changedFiles=$(git diff-tree --no-commit-id --name-only -r $BUILDKITE_COMMIT)

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