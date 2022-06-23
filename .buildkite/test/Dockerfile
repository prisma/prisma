FROM node:14-buster

RUN npm install -g pnpm@6
WORKDIR /app
COPY pnpm-lock.yaml .
RUN pnpm fetch