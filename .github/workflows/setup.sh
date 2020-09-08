#!/bin/bash

set -ex

cd src

npm i --silent -g pnpm@5.1.7
pnpm i --no-prefer-frozen-lockfile --reporter=silent --ignore-scripts

pnpm run setup
