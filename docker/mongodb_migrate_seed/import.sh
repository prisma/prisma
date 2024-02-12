#!/usr/bin/env bash

set -ex

echo "Seed (import.sh): Importing data will start..."

sleep 10s

mongoimport --uri mongodb://127.0.0.1:27017/tests-migrate --drop --collection users --type json --file /mongodb_migrate_seed/data/init.json --jsonArray

echo "Seed (import.sh): Data imported."


