#!/bin/bash

set -ex
env

# Wait for Postgres
export changedFiles=$(git diff-tree --no-commit-id --name-only -r $BUILDKITE_COMMIT)

# Run prisma2 tests
cd prisma2
yarn
yarn test
cd ../introspection
yarn
yarn build
yarn test