FROM alpine:latest

RUN apk add --no-cache g++ bash rlwrap

WORKDIR /code
