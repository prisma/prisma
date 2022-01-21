#!/bin/bash
set -e

mongod --port 27018 --replSet rs0 --bind_ip_all &
PID=$!

until (mongo admin --quiet --port 27018 --eval "db"); do sleep 3; done

CONFIG="{ _id: 'rs0', members: [{_id: 0, host: 'localhost:27018'}]}"
mongo admin --port 27018 --eval "db.runCommand({ replSetInitiate: $CONFIG })" || true
mongo admin --port 27018 --eval "db.createUser({ user: 'root', pwd: 'prisma', roles: [ 'root' ] })" || true

echo "REPLICA SET ONLINE"

wait $PID