#!/bin/bash

set -ex

# Docs about ~~~ & +++: https://buildkite.com/docs/pipelines/managing-log-output
# The folowing makes it that the relevant section will be auto-expanded if it throws an error
expand_headers_on_error() {
  echo "^^^ +++"
}
trap expand_headers_on_error ERR

echo "~~~ Set variables depending on BUILDKITE_PARALLEL_JOB"
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

echo "~~~ Install pnpm"
npm i --silent -g pnpm@7 --unsafe-perm
# --usafe-perm to allow install scripts

echo "~~~ pnpm i"
pnpm i --unsafe-perm

# JOB 0
if [ "$BUILDKITE_PARALLEL_JOB" = "0" ]; then
  echo "~~~ Linting"
  # Only run lint for job 0
  pnpm run lint
fi

echo "+++ pnpm, node, npm versions"
# Output versions
pnpm -v
node -v
npm -v

echo "~~~ pnpm run setup"
# See package.json setup script
pnpm run setup

echo "~~~ @prisma/client test:functional"
echo "Start testing..."
pnpm run --filter "@prisma/client" test:functional

echo "~~~ Test all packages"
pnpm run test

echo "~~~ @prisma/client test:memory"
# Client memory test suite Note: we run it last as DB is not isolated and will
# be dropped after memory tests, which in turn will fail subsequent tests.  We
# should fix it in a similar way we did for functional tests, eventually.
pnpm run --filter "@prisma/client" test:memory
