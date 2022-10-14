#!/bin/bash

set -ex

# Install pnpm
npm i --silent -g pnpm@7 --unsafe-perm
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
    # New client test suite
    pnpm run --filter "@prisma/client" test:functional

    # Run test for all packages
    pnpm run test

    # Client memory test suite
    # Note: we run it last as DB is not isolated and will be dropped after memory tests, which in turn will fail subsequent tests.
    # We should fix it in a similar way we did for functional tests, eventually.
    pnpm run --filter "@prisma/client" test:memory
fi

# Disable printing with +x and return as before just after
set +x
# Set NPM token for publishing
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
set -ex

# Publish all packages
pnpm run publish-all
