#!/bin/bash

mongod --port $PORT --replSet rs0 --bind_ip 0.0.0.0 & MONGOD_PID=$!;

until (mongo admin --quiet --port $PORT --eval "db"); do sleep 1; done; sleep 10;
mongo admin --quiet --port $PORT --eval "db.runCommand({ replSetInitiate: { _id: 'rs0', members: [{ _id: 0, host: '$HOST:$PORT' }] } })";
mongo admin --quiet --port $PORT --eval "db.createUser({ user: 'root', pwd: 'prisma', roles: [ 'root' ] })" 2&> /dev/null || true;

echo "REPLICA SET ONLINE";

wait $MONGOD_PID;
