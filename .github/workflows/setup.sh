#!/bin/bash

set -ex

npm i --silent -g pnpm@5.10.4 --unsafe-perm

pnpm i --no-prefer-frozen-lockfile
cd src

pnpm i --no-prefer-frozen-lockfile

pnpm run setup
