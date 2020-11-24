#!/bin/bash

set -ex

cd src

node -v
npm -v

npm i --silent -g pnpm@5.10.4 --unsafe-perm

pnpm i --no-prefer-frozen-lockfile

pnpm run setup

cd packages/tests
pnpm i sqlite3@4.2 --unsafe-perm --reporter=silent
cd ../..

pnpm run test
