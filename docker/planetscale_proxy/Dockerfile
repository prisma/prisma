FROM ghcr.io/mattrobenolt/ps-http-sim:v0.0.11 AS planetscale-proxy

# ps-http-sim provides a barebones image with nothing but the static binary
# but we also rely on netcat being present. Alpine provides it as part of busybox.
FROM alpine:latest

COPY --from=planetscale-proxy /ps-http-sim /ps-http-sim

ENTRYPOINT /ps-http-sim \
  -listen-addr=0.0.0.0 \
  -listen-port=8085 \
  -mysql-addr=$MYSQL_HOST \
  -mysql-port=$MYSQL_PORT \
  -mysql-idle-timeout=1200s \
  -mysql-no-pass \
  -mysql-max-rows=1000 \
  -mysql-dbname=$MYSQL_DATABASE
