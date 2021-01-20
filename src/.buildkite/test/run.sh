#!/bin/bash

set -ex

npm i --silent -g pnpm@5.15.1 --unsafe-perm

pnpm i --no-prefer-frozen-lockfile

# Only run lint for job 0
if [ "$BUILDKITE_PARALLEL_JOB" = "0" ]; then
    pnpm run lint
fi

node -v
npm -v

cd src

pnpm i --no-prefer-frozen-lockfile

pnpm run setup

pnpm run test
