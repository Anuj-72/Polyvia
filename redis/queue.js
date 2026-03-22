const redisConnection = require("./redis-connection");
const { Queue } = require("bullmq");

const stdinQueue = new Queue("stdin-jobs", {
    connection: redisConnection,
});

module.exports = stdinQueue;
