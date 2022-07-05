#!/bin/bash

set -ex

# The below is required as during install required engines are downloaded, so this makes sure the engines being tested are already present 

# JOB 0 - Node-API Library
if [ "$BUILDKITE_PARALLEL_JOB" = "0" ]; then
  export PRISMA_CLIENT_ENGINE_TYPE='library'
  export PRISMA_CLI_QUERY_ENGINE_TYPE='library'
fi
# JOB 1 - Binary
if [ "$BUILDKITE_PARALLEL_JOB" = "1" ]; then
  export PRISMA_CLIENT_ENGINE_TYPE='binary'
  export PRISMA_CLI_QUERY_ENGINE_TYPE='binary'
fi

# Install pnpm
npm i --silent -g pnpm@7 --unsafe-perm
# --usafe-perm to allow install scripts

# Install packages
pnpm i --unsafe-perm

# JOB 0
if [ "$BUILDKITE_PARALLEL_JOB" = "0" ]; then
  # Only run lint for job 0
  pnpm run lint
fi

# Output versions
pnpm -v
node -v
npm -v

# See package.json setup script
pnpm run setup


# New client test suite
# 
pnpm run --filter "@prisma/client" test:functional

echo "Start testing..."
# Run test for all packages
pnpm run test
