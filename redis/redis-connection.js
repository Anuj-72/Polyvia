const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { Redis } = require("ioredis");

const redisConnection = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
    maxRetriesPerRequest: null,
});

module.exports = redisConnection;
