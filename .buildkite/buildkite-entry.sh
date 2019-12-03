#!/bin/bash

set -ex


apt-get update
apt-get install nodejs npm -y
npm i -g last-git-changes
last-git-changes --exclude='docs,examples,scripts,README.md,LICENSE,CONTRIBUTING.md'

# buildkite-agent pipeline upload .buildkite/trigger.yml

