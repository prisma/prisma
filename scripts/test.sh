#!/bin/bash

set -ex
env

# Wait for Postgres
for i in `seq 1 10`;
do
  nc -z postgres 5432 && echo Success && exit 0
  echo -n .
  sleep 2
done
echo Failed waiting for Postgres && exit 1

# Run prisma2 tests
cd prisma2
yarn
yarn prepare
yarn test
cd ../introspection
yarn
yarn build
yarn test