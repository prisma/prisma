#!/bin/bash
echo $NPM_TOKEN > ~/.npmrc

set -ex

npm i --silent -g pnpm@5.15.1 --unsafe-perm

pnpm i --no-prefer-frozen-lockfile
cd src

pnpm i --no-prefer-frozen-lockfile  -r --filter "@prisma/engines" --filter "@prisma/engines-version"

pnpm run build -r --filter "@prisma/engines" --filter "@prisma/engines-version"
