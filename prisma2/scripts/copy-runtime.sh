#!/usr/bin/env bash

mkdir -p runtime
mkdir -p nexus_prisma_ncc_build
mkdir -p prisma-test-utils_ncc
cp -R node_modules/@prisma/photon/runtime/* runtime
cp -R node_modules/nexus-prisma/nexus_prisma_ncc_build/* nexus_prisma_ncc_build
cp -R node_modules/prisma-test-utils/prisma-test-utils_ncc/* prisma-test-utils_ncc
cp node_modules/@prisma/lift/dist/GeneratorWorker.js build/GeneratorWorker.js
cp -R node_modules/@prisma/studio-server/public/* build/public
rm -rf build/public/static/js/*.map
rm -rf build/public1/static/js/*.map