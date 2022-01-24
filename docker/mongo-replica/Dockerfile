FROM mongo:5

ENTRYPOINT mongod --port $PORT --replSet rs0 --bind_ip 0.0.0.0 & MONGOD_PID=$!; \
INIT_REPL_CMD="rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '$HOST:$PORT' }] })"; \
INIT_USER_CMD="db.createUser({ user: 'root', pwd: 'prisma', roles: [ 'root' ] })"; \
until (mongo admin --port $PORT --eval "$INIT_REPL_CMD && $INIT_USER_CMD"); do sleep 1; done; \
echo "REPLICA SET ONLINE"; wait $MONGOD_PID; \
