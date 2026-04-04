const { QueueEvents } = require("bullmq");
const logger = require("../backend/utils/logger");
const redisConnection = require("./redis-connection");
const {
    codeToSocket,
    runningJobs,
} = require("../backend/handlers/stdinHandler");

const stdinQueueEvents = new QueueEvents("stdin-jobs", {
    connection: redisConnection,
});

const onCompleted = (io) => {
    stdinQueueEvents.on("completed", ({ jobId, returnvalue }) => {
        if (!returnvalue) return;

        const socketID = codeToSocket.get(jobId);

        if (!socketID) {
            logger.warn("Socket not found for jobID", { jobId: jobId });
            return;
        }

        logger.info("Stdin job completed", {
            jobId,
            socketId: socketID,
        });

        io.to(socketID).emit("stdin-result", {
            output: returnvalue.output,
            error: returnvalue.error,
        });

        runningJobs.delete(socketID);
        codeToSocket.delete(jobId);
    });
};

const onFailed = (io) => {
    stdinQueueEvents.on("failed", async ({ jobId, failedReason }) => {
        logger.error("Job failed", { jobId, failedReason });
        const socketID = codeToSocket.get(jobId);

        if (!socketID) {
            logger.warn("Socket not found for jobID", { jobId: jobId });
            return;
        }

        io.to(socketID).emit("stdin-result", {
            output: "",
            error: `Job Failed: ${failedReason}`,
        });

        runningJobs.delete(socketID);
        codeToSocket.delete(jobId);
    });
};

module.exports = { onCompleted, onFailed, stdinQueueEvents };
