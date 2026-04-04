const fs = require("fs");
const crypto = require("crypto");
const logger = require("../utils/logger");
const stdinQueue = require("../../redis/queue");

const submissionTokens = new Map();
const codeToSocket = new Map(); // codeID -> socketID
const runningJobs = new Set();
const MAX_TOKENS = 10,
    REFILL_RATE = 6000;

const stdinHandler = (socket) => {
    // Logic for rate limiting - Token Bucket Algo
    submissionTokens.set(socket.id, MAX_TOKENS);

    const refill = setInterval(() => {
        const curr = submissionTokens.get(socket.id) ?? MAX_TOKENS;
        submissionTokens.set(socket.id, Math.min(curr + 1, MAX_TOKENS));
    }, REFILL_RATE);

    let codeID;
    socket.on("stdin-run", async (data) => {
        if (runningJobs.has(socket.id)) {
            socket.emit("stdin-BUSY", "Wait for current execution");
            return;
        }

        const tokens = submissionTokens.get(socket.id) ?? MAX_TOKENS;

        // If tokens exhausted -> simply return - wait a moment message
        if (tokens <= 0) {
            logger.warn("Socket submission limit exceeded", {
                socketId: socket.id,
            });
            socket.emit(
                "LTE-stdin",
                "Submission limit exhausted — wait a moment",
            );
            return;
        }

        submissionTokens.set(socket.id, tokens - 1);
        runningJobs.add(socket.id);

        codeID = crypto.randomUUID();
        const pathTemp = `/tmp/${codeID}`;

        fs.mkdirSync(pathTemp, { recursive: true });
        fs.writeFileSync(`${pathTemp}/main.cpp`, data.code);
        fs.writeFileSync(`${pathTemp}/input`, data.input);

        await stdinQueue.add(
            "job",
            {
                codeID,
                pathTemp,
                socketID: socket.id,
            },
            {
                jobId: codeID,
            },
        );

        codeToSocket.set(codeID, socket.id);
        logger.info("Stdin job queued", { socketId: socket.id, codeID });
    });

    socket.on("disconnect", () => {
        clearInterval(refill);
        for (const [cid, sid] of codeToSocket.entries()) {
            if (sid === socket.id) {
                codeToSocket.delete(cid);
            }
        }
        submissionTokens.delete(socket.id);
    });
};

module.exports = { stdinHandler, codeToSocket, runningJobs };
