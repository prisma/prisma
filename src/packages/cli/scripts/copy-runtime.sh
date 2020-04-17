#!/usr/bin/env bash

set -ex

mkdir -p runtime
mkdir -p nexus_prisma_ncc_build
mkdir -p build/prisma-client-generator
mkdir -p build/dist

# cp -R "$(./scripts/resolve.js @prisma/client)/runtime"/* build/runtime
# cp -R "$(./scripts/resolve.js @prisma/client)/generator-build"/* build/prisma-client-generator

node ./scripts/copy-prisma-client.js

rm -rf runtime/prisma

cp "$(./scripts/resolve.js @prisma/migrate)/dist/GeneratorWorker.js" build/GeneratorWorker.js
cp "$(./scripts/resolve.js checkpoint-client)/dist/child.js" build/child.js

rm -rf build/public

cp -R "$(./scripts/resolve.js @prisma/studio)/build/" build/public

rm -rf build/prisma
rm -rf build/runtime/prisma