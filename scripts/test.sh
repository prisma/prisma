#!/bin/bash

set -ex
env

diff -u <(git rev-list --first-parent topic) \
             <(git rev-list --first-parent master) | \
     sed -ne 's/^ //p' | head -1

# Wait for Postgres

# Run prisma2 tests
cd prisma2
yarn
yarn test
cd ../introspection
yarn
yarn build
yarn test