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

# New client test suite
pnpm run test:functional --filter "@prisma/client"

# Run test for all packages
pnpm run test

# Disable printing with +x and return as before just after
set +x
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
set -ex

# Publish all packages
pnpm run publish-all
