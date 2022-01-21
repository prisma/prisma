#!/bin/bash

until (mongo admin --quiet --host $HOST --port $PORT --eval "db"); do sleep 3; done
mongo admin --host $HOST --port $PORT --eval "db.runCommand({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: '$HOST:$PORT' }] } })" || true
mongo admin --host $HOST --port $PORT --eval "db.createUser({ user: 'root', pwd: 'prisma', roles: [ 'root' ] })" || true

echo "REPLICA SET ONLINE"
