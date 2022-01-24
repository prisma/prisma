#!/bin/bash

mongod --port $PORT --replSet rs0 --bind_ip_all &
PID=$!

until (mongo admin --quiet --port $PORT --eval "db"); do sleep 3; done
mongo admin --quiet --port $PORT --eval "db.runCommand({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: '$HOST:$PORT' }] } })"
mongo admin --quiet --port $PORT --eval "db.createUser({ user: 'root', pwd: 'prisma', roles: [ 'root' ] })"

echo "REPLICA SET ONLINE"

wait $PID
