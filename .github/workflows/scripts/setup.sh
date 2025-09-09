#!/bin/bash

set -ex

npm i --silent -g pnpm@10 --unsafe-perm

pnpm i

pnpm run build
