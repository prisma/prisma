#!/usr/bin/env bash

set -ex

cp -R "$(./scripts/resolve.js @prisma/studio)/build/" dist/public
