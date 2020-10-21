#!/bin/bash

set -ex

cd src

npm i --silent -g pnpm@5.1.7 --unsafe-perm
pnpm i --no-prefer-frozen-lockfile --reporter=silent

pnpm run setup
