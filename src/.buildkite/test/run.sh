#!/bin/bash

set -ex

cd src

npm i --silent -g pnpm@5.1.7
pnpm i --no-prefer-frozen-lockfile --reporter=silent --ignore-scripts

pnpm run setup

cd packages/cli
pnpm i sqlite3@4.1 --unsafe-perm --reporter=silent
cd ../..

pnpm run test
