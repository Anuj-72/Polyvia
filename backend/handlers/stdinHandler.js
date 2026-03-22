const fs = require("fs");
const crypto = require("crypto");
const logger = require("../utils/logger");
const stdinQueue = require("../../redis/queue");

module.exports = (socket) => {
    socket.on("stdin-run", async (data) => {
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
};
