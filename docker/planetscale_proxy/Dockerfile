FROM golang:1

RUN apt update && apt install netcat-openbsd -y
RUN git clone https://github.com/mattrobenolt/ps-http-sim.git

ENTRYPOINT cd /go/ps-http-sim && go run . \
  -http-addr=0.0.0.0 \
  -http-port=8085 \
  -mysql-addr=$MYSQL_HOST \
  -mysql-port=$MYSQL_PORT \
  -mysql-idle-timeout=5s \
  -mysql-no-pass \
  -mysql-max-rows=1000 \
  -mysql-dbname=$MYSQL_DATABASE
