const logger = require("../utils/logger");
const redisConnection = require("../../redis/redis-connection");
const os = require("os");

const healthCheck = async (req, res) => {
    try {
        await redisConnection.ping();

        const memoryUsed = process.memoryUsage().heapUsed;
        const totalMemory = os.totalmem();

        logger.info("Health Check Passed");

        res.status(200).json({
            status: "ok",
            uptime: Math.floor(process.uptime()),
            timestamp: new Date().toISOString(),
            redis: "ok",
            memory: {
                used: `${Math.round(memoryUsed / 1024 / 1024)} MB`,
                total: `${Math.round(totalMemory / 1024 / 1024)} MB`,
            },
        });
    } catch (error) {
        logger.error("Health Checkup Failed");

        res.status(503).json({
            status: "error",
            uptime: Math.error(process.uptime()),
            timestamp: new Date().toISOString(),
            redis: "unreachable",
            error: error.message,
        });
    }
};

module.exports = healthCheck;
