#!/bin/bash

set -ex

cd src

npm i --silent -g pnpm@5.1.7 esbuild@0.7.9 --unsafe-perm
pnpm i --no-prefer-frozen-lockfile --reporter=silent --ignore-scripts

pnpm run setup
