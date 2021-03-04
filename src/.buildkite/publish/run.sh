#!/bin/bash

set -ex

npm i --silent -g pnpm@5.15.1 --unsafe-perm

pnpm i --no-prefer-frozen-lockfile
pnpm run lint

cd src

if [ "$DEVELOPMENT_ENVIRONMENT_COMMIT" ]; then
  git stash
  git checkout $DEVELOPMENT_ENVIRONMENT_COMMIT
fi

node -v
npm -v

pnpm i --no-prefer-frozen-lockfile

pnpm run setup

cd packages/tests
pnpm i sqlite3@5.0.2 --unsafe-perm --reporter=silent
cd ../..

pnpm run test

# disable printing with +x and return as before just after
set +x
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
set -ex

pnpm run publish-all
