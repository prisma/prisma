#!/bin/bash

set -ex

npm i -g pnpm
pnpm i --no-prefer-frozen-lockfile

pnpm run setup

cd src/packages/prisma2
pnpm i sqlite3@4.1.1 --unsafe-perm
cd ../../..

pnpm run test
