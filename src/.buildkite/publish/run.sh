#!/bin/bash

set -ex

cd src

if [ "$DEVELOPMENT_ENVIRONMENT_COMMIT" ]; then
  git stash
  git checkout $DEVELOPMENT_ENVIRONMENT_COMMIT
fi

npm i --silent -g pnpm@5.1.7
npm i --silent -g yarn || echo "Ok"
yarn --version || echo "Ok"
pnpm i --no-prefer-frozen-lockfile --reporter=silent

pnpm run setup

cd packages/cli
pnpm i sqlite3@4.1 --unsafe-perm --reporter=silent
cd ../..

pnpm run test

# disable printing with +x and return as before just after
set +x
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
set -ex

pnpm run publish-all
