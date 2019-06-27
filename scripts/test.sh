#!/bin/bash

set -ex
env

# Wait for Postgres
sleep 15

# Run prisma2 tests
cd prisma2
yarn
yarn prepare
yarn test
cd ../introspection
yarn
yarn build
yarn test