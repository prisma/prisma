#!/bin/bash

set -ex

npm i --silent -g pnpm@9 --unsafe-perm

pnpm i

pnpm run build
