#!/bin/bash

set -ex

cd src

npm i --silent -g pnpm@5.9.3 --unsafe-perm
pnpm i --no-prefer-frozen-lockfile

pnpm run setup
