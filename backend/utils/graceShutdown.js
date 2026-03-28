const logger = require("./logger");
const stdinQueue = require("../../redis/queue");
const redisConnection = require("../../redis/redis-connection");
const { stdinQueueEvents } = require("../../redis/queue-events");

module.exports = async ({ server, io, activeSessions }) => {
    logger.info("Graceful shutdown initiated");

    server.close(() => {
        logger.info("HTTP server closed");
    });

    io.close(() => {
        logger.info("Socket.io server closed");
    });

    for (const [socketID, session] of activeSessions) {
        logger.info("Cleaning up active sessions", { socketID });
        try {
            session.cleanup();
        } catch (e) {}
    }

    await stdinQueueEvents.close();
    logger.info("QueueEvents closed");

    await stdinQueue.close();
    logger.info("BullMQ Queue closed");

    await redisConnection.quit();
    logger.info("Redis connection closed");

    logger.info("Shutdown completed gracefully");
    process.exit(0);
};
