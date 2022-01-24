#!/bin/bash

mongod --port $PORT --replSet rs0 --bind_ip 0.0.0.0 & MONGOD_PID=$!;

CMD="rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '$HOST:$PORT' }] }) && db.createUser({ user: 'root', pwd: 'prisma', roles: [ 'root' ] })"
until (mongo admin --port $PORT --eval "$CMD"); do sleep 1; done;

echo "REPLICA SET ONLINE";
wait $MONGOD_PID;
