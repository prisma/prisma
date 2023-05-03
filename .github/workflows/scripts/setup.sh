#!/bin/bash

set -ex

npm i --silent -g pnpm@7 --unsafe-perm

DEBUG="prisma:download" pnpm i

pnpm run setup
