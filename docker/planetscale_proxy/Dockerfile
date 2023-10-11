FROM golang:1

RUN apt update && apt install netcat-openbsd -y
RUN cd /go/src && git clone https://github.com/prisma/planetscale-proxy.git
RUN cd /go/src/planetscale-proxy && go install .

ENTRYPOINT /go/bin/planetscale-proxy \
  -http-addr=0.0.0.0 \
  -http-port=8085 \
  -mysql-addr=$MYSQL_HOST \
  -mysql-port=$MYSQL_PORT \
  -mysql-idle-timeout=1200s \
  -mysql-no-pass \
  -mysql-max-rows=1000 \
  -mysql-dbname=$MYSQL_DATABASE
