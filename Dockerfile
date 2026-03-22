FROM alpine:latest

RUN apk add --no-cache g++ bash

WORKDIR /code
