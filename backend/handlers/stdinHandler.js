const fs = require("fs");
const crypto = require("crypto");
const logger = require("../utils/logger");
const stdinQueue = require("../../redis/queue");

const submissionTokens = new Map();
const MAX_TOKENS = 10,
    REFILL_RATE = 6000;

module.exports = (socket) => {
    submissionTokens.set(socket.id, MAX_TOKENS);

    const refill = setInterval(() => {
        const curr = submissionTokens.get(socket.id) ?? MAX_TOKENS;
        submissionTokens.set(socket.id, Math.min(curr + 1, MAX_TOKENS));
    }, REFILL_RATE);

    socket.on("stdin-run", async (data) => {
        const tokens = submissionTokens.get(socket.id) ?? MAX_TOKENS;

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

        const codeID = crypto.randomUUID();
        const pathTemp = `/tmp/${codeID}`;

        fs.mkdirSync(pathTemp, { recursive: true });
        fs.writeFileSync(`${pathTemp}/main.cpp`, data.code);
        fs.writeFileSync(`${pathTemp}/input`, data.input);

        await stdinQueue.add("job", {
            codeID,
            pathTemp,
            socketID: socket.id,
        });

        logger.info("Stdin job queued", { socketId: socket.id, codeID });
    });

    socket.on("disconnect", () => {
        clearInterval(refill);
        submissionTokens.delete(socket.id);
    });
};
