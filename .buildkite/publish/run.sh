#!/bin/bash

set -ex

# Install pnpm
npm i --silent -g pnpm@6 --unsafe-perm # TODO: is this unsafe-perm needed?

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
    pnpm run test:functional --filter "@prisma/client"

    # Run test for all packages
    pnpm run test
fi

# Disable printing with +x and return as before just after
set +x
# Set NPM token for publishing
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
set -ex

# Publish all packages
pnpm run publish-all
