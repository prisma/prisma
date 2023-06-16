#!/bin/bash

set -ex

npm i --silent -g pnpm@7 --unsafe-perm

pnpm i

pnpm run setup
