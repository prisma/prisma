#!/usr/bin/env bash

set -ex

mkdir -p runtime
mkdir -p nexus_prisma_ncc_build
mkdir -p build/prisma-client-generator


# cp -R "$(./scripts/resolve.js @prisma/photon)/runtime"/* build/runtime
# cp -R "$(./scripts/resolve.js @prisma/photon)/generator-build"/* build/photon-generator

node ./scripts/copy-prisma-client.js

rm -rf runtime/prisma

cp "$(./scripts/resolve.js @prisma/lift)/dist/GeneratorWorker.js" build/GeneratorWorker.js
cp "$(./scripts/resolve.js checkpoint-client)/dist/child.js" build/child.js

rm -rf build/public

cp -R "$(./scripts/resolve.js @prisma/studio)/build/" build/public

rm -rf build/prisma
rm -rf build/runtime/prisma
cp src/capture-worker.js build/dist/capture-worker.js