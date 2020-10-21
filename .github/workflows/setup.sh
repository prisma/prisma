#!/bin/bash

set -ex

cd src

npm i --silent -g pnpm@5.1.7 --unsafe-perm
pnpm i --no-prefer-frozen-lockfile

pnpm run setup
