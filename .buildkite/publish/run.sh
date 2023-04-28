#!/bin/bash

set -ex

# Docs about ~~~ & +++: https://buildkite.com/docs/pipelines/managing-log-output
# The folowing makes it that the relevant section will be auto-expanded if it throws an error
expand_headers_on_error() {
  echo "^^^ +++"
}
trap expand_headers_on_error ERR

echo "~~~ Install pnpm"
npm i --silent -g pnpm@7 --unsafe-perm
# --usafe-perm to allow install scripts

echo "~~~ pnpm i"
pnpm i

echo "+++ pnpm, node, npm versions"
# Output versions
pnpm -v
node -v
npm -v

echo "~~~ pnpm run setup"
# See package.json setup script
pnpm run setup

if [[ $BUILDKITE_BRANCH == integration/* ]] ;
then
    echo "+++ Integration branch"
    echo "Testing was skipped as it's an integration branch. For tests, check GitHub Actions or the Buildkite testing pipeline https://buildkite.com/prisma/test-prisma-typescript"
else
    echo "Start testing..."
    echo "~~~ @prisma/client test:functional"
    pnpm run --filter "@prisma/client" test:functional

    echo "~~~ Test all packages"
    pnpm run test

    echo "~~~ @prisma/client test:memory"
    # Client memory test suite
    # Note: we run it last as DB is not isolated and will be dropped after memory tests, which in turn will fail subsequent tests.
    # We should fix it in a similar way we did for functional tests, eventually.
    pnpm run --filter "@prisma/client" test:memory
fi

echo "+++ Publishing packages to npm"
# Disable printing with +x and return as before just after
set +x
# Set NPM token for publishing
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
set -ex

# Publish all packages
pnpm run publish-all
