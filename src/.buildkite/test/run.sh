#!/bin/bash

set -ex

npm i --silent -g pnpm@5.10.4 --unsafe-perm


pnpm i --no-prefer-frozen-lockfile
pnpm run lint

node -v
npm -v


cd src

pnpm i --no-prefer-frozen-lockfile

pnpm run setup

cd packages/tests
pnpm i sqlite3@5.0 --unsafe-perm --reporter=silent
cd ../..

pnpm run test
