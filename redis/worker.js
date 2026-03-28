const fs = require("fs");
const util = require("util");
const { Worker } = require("bullmq");
const { exec } = require("child_process");
const logger = require("../backend/utils/logger");
const redisConnection = require("./redis-connection");
const { DOCKER_STDIN_COMMAND } = require("../backend/utils/dockerCommands");

const execPromise = util.promisify(exec);

const gracefulShutdown = async (signal) => {
    logger.info("Worker graceful shutdown initiated");
    await worker.close(); // waits for active jobs to complete
    await redisConnection.quit();
    logger.info("Worker shutdown complete");
    process.exit(0);
};

const worker = new Worker(
    "stdin-jobs",
    async (job) => {
        const pathTemp = job.data.pathTemp;
        const socketID = job.data.socketID;

        try {
            const { stdout, stderr } = await execPromise(
                DOCKER_STDIN_COMMAND(pathTemp),
            );

            logger.info("Job completed", { socketID, pathTemp });
            return {
                output: stdout,
                error: stderr,
                socketID: socketID,
            };
        } catch (err) {
            logger.error("Job execution failed", {
                error: err.message,
                socketID,
            });
            return {
                output: err.stdout || "",
                error: err.stderr || err.message,
                socketID: socketID,
            };
        } finally {
            fs.rmSync(pathTemp, { recursive: true, force: true });
            logger.info("Job cleanup complete", { pathTemp, socketID });
        }
    },
    {
        connection: redisConnection,
        concurrency: parseInt(process.env.WORKER_CONCURRENCY) || 4,
    },
);

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

module.exports = worker;
