#!/bin/bash

set -ex

npm i --silent -g pnpm@7 --unsafe-perm

pnpm i

DEBUG="prisma:download" pnpm run setup
