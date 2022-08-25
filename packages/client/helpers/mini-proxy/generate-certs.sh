#!/bin/bash

set -euxo pipefail

if [[ $# -ne 5 ]]; then
  >&2 echo "usage: generate-certs.sh CA_KEY CA_CERT CSR KEY CERT"
  exit 1
fi

CA_KEY=$1
CA_CERT=$2
CSR=$3
KEY=$4
CERT=$5

openssl req -x509 -newkey rsa:4096 -nodes -sha256 -days 3650 \
  -keyout "$CA_KEY" -out "$CA_CERT" \
  -subj "/O=Prisma"

openssl req -newkey rsa:4096 -nodes \
  -keyout "$KEY" -out "$CSR" \
  -subj "/CN=localhost" \
  -extensions san -config <(echo '[req]';
                            echo 'distinguished_name=req';
                            echo '[san]';
                            echo 'subjectAltName=DNS:localhost,IP:127.0.0.1')

openssl x509 -req -sha256 -days 3650 \
  -in "$CSR" -out "$CERT" \
  -CA "$CA_CERT" -CAkey "$CA_KEY" -CAcreateserial
