#!/usr/bin/env bash

set -ex

mkdir -p runtime
mkdir -p nexus_prisma_ncc_build
mkdir -p prisma-test-utils_ncc
mkdir -p build/photon-generator


# cp -R "$(./scripts/resolve.js @prisma/photon)/runtime"/* build/runtime
# cp -R "$(./scripts/resolve.js @prisma/photon)/generator-build"/* build/photon-generator


rm -rf runtime/prisma

cp "$(./scripts/resolve.js @prisma/lift)/dist/GeneratorWorker.js" build/GeneratorWorker.js
cp "$(./scripts/resolve.js @prisma/studio-transports)/build/photon-worker.js" build/photon-worker.js

rm -rf build/public

cp -R "$(./scripts/resolve.js @prisma/studio)/build/" build/public

rm -rf build/prisma
rm -rf build/runtime/prisma
cp src/capture-worker.js build/dist/capture-worker.js