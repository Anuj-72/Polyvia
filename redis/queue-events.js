const stdinQueue = require("./queue");
const { QueueEvents, Job } = require("bullmq");
const logger = require("../backend/utils/logger");
const redisConnection = require("./redis-connection");

const stdinQueueEvents = new QueueEvents("stdin-jobs", {
    connection: redisConnection,
});

const onCompleted = (io) => {
    stdinQueueEvents.on("completed", ({ jobId, returnvalue }) => {
        if (!returnvalue) return;

        logger.info("Stdin job completed", {
            jobId,
            socketId: returnvalue.socketID,
        });

        io.to(returnvalue.socketID).emit("stdin-result", {
            output: returnvalue.output,
            error: returnvalue.error,
        });
    });
};

const onFailed = (io) => {
    stdinQueueEvents.on("failed", async ({ jobId, failedReason }) => {
        logger.error("Job failed", { jobId, failedReason });

        try {
            const job = await Job.fromId(stdinQueue, jobId);

            if (job) {
                const socketID = job.data.socketID;
                io.to(socketID).emit("stdin-result", {
                    output: "",
                    error: `Job Failed: ${failedReason}`,
                });
            }
        } catch (error) {
            logger.error("Couldn't fetch failed Job Data", {
                error: error.message,
            });
        }
    });
};

module.exports = { onCompleted, onFailed, stdinQueueEvents };
