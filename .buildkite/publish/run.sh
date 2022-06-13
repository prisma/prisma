#!/bin/bash

set -ex

# Install pnpm
npm i --silent -g pnpm@6 --unsafe-perm
# --usafe-perm to allow install scripts

# Install packages
pnpm i

# Output versions
pnpm -v
node -v
npm -v

# See package.json setup script
pnpm run setup

if [[ $BUILDKITE_BRANCH == integration/* ]] ;
then
    echo "Testing was skipped as it's an integration branch. For tests, check GitHub Actions or the Buildkite testing pipeline https://buildkite.com/prisma/test-prisma-typescript"
else
    echo "Start testing..."
    # Run test for all packages
    pnpm run test

    # New client test suite
    # 
    # TODO make make side effect free and isolated since it can right now, only be ran after `pnpm run test`
    # because it drops the postgresql `tests` database which result in the following error during `pnpm run test` if `test:functional` are run before
    # FAIL  src/__tests__/integration/postgresql/runtime.test.ts
    # FAIL  src/__tests__/integration/postgresql/introspection.test.ts
    #  error: database "tests" does not exist
    # Test Suites: 2 failed, 8 passed, 10 total
    # https://buildkite.com/prisma/release-prisma-typescript/builds/6514
    pnpm run test:functional --filter "@prisma/client"
fi

# Disable printing with +x and return as before just after
set +x
# Set NPM token for publishing
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
set -ex

# Publish all packages
pnpm run publish-all
