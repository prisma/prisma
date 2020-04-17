#!/bin/bash

set -ex

cd src

npm i -g pnpm
pnpm i --no-prefer-frozen-lockfile

pnpm run setup

cd packages/cli
pnpm i sqlite3@4.1 --unsafe-perm
cd ../..

pnpm run test
