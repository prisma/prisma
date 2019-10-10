#!/usr/bin/env bash

mkdir -p runtime
mkdir -p nexus_prisma_ncc_build
mkdir -p prisma-test-utils_ncc
mkdir -p build/photon-generator
cp -R node_modules/@prisma/photon/runtime/* build/runtime
cp -R node_modules/@prisma/photon/generator-build/* build/photon-generator

rm -rf runtime/prisma
# cp -R node_modules/prisma-test-utils/prisma-test-utils_ncc/* prisma-test-utils_ncc
cp node_modules/@prisma/lift/dist/GeneratorWorker.js build/GeneratorWorker.js
cp node_modules/@prisma/studio-transports/build/photon-worker.js build/photon-worker.js
rm -rf build/public
mkdir build/public
cp -R node_modules/@prisma/studio/build/* build/public
rm -rf build/prisma
rm -rf build/runtime/prisma
cp src/capture-worker.js build/dist/capture-worker.js