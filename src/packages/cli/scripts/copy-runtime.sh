#!/usr/bin/env bash

set -ex

mkdir -p build/dist


node ./scripts/copy-prisma-client.js

cp "$(./scripts/resolve.js checkpoint-client)/dist/child.js" build/child.js
cp -R "$(./scripts/resolve.js @prisma/studio)/build/" build/public


