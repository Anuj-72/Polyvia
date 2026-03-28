const fs = require("fs");
const pty = require("node-pty");
const crypto = require("crypto");
const logger = require("../utils/logger");
const EXIT_CODE_MAP = require("../utils/exitCodes");
const { DOCKER_INTERACTIVE_ARGS } = require("../utils/dockerCommands");

const submissionToken = new Map();
const MAX_TOKENS = 10;
const REFILL_RATE = 6000;
const MAX_CONCURRENT = parseInt(process.env.INTERACTIVE_CONCURRENCY) || 4;
const waitingQueue = []; // {socket, data}

const trySpawn = (socket, data, activeSessions) => {
    const codeID = crypto.randomUUID();
    const pathTemp = `/tmp/${codeID}`;

    fs.mkdirSync(pathTemp, { recursive: true });
    fs.writeFileSync(`${pathTemp}/main.cpp`, data.code);

    let ptyProcess;
    try {
        ptyProcess = pty.spawn("docker", DOCKER_INTERACTIVE_ARGS(pathTemp), {
            name: "xterm-color",
            cols: 80,
            rows: 30,
            cwd: process.env.HOME,
            env: process.env,
        });
    } catch (error) {
        logger.error("PTY Spawn Failed", {
            error: error.message,
            socketId: socket.id,
        });
        fs.rmSync(pathTemp, { recursive: true, force: true });
        return;
    }

    if (!ptyProcess) return;

    socket.removeAllListeners("term:in");

    socket.on("term:in", (data) => {
        ptyProcess.write(data);
    });

    ptyProcess.onData((data) => {
        socket.emit("term:out", data);
    });

    const cleanup = () => {
        fs.rmSync(pathTemp, { recursive: true, force: true });
        try {
            ptyProcess.kill();
        } catch (e) {}
        activeSessions.delete(socket.id);

        if (waitingQueue.length > 0) {
            const next = waitingQueue.shift();

            waitingQueue.forEach((item, index) => {
                item.socket.emit(
                    "QUEUED-interactive",
                    `Server Busy - You're at #${index + 1} position`,
                );
            });

            logger.info("Spawning next queued job", {
                socketId: next.socket.id,
                queueLength: waitingQueue.length,
            });

            trySpawn(next.socket, next.data, activeSessions);
        }
    };

    activeSessions.set(socket.id, { cleanup });

    ptyProcess.onExit(({ exitCode, signal }) => {
        if (exitCode === 0) {
            logger.info("Normal exit", { socketId: socket.id, exitCode });
            socket.emit("ACC", "Accepted");
        } else {
            logger.warn("Non-zero exit", {
                socketId: socket.id,
                exitCode,
                signal,
            });
            const event = EXIT_CODE_MAP.get(exitCode);
            event
                ? socket.emit(event[0], event[1])
                : socket.emit("RTE", `Runtime Error: ${exitCode}`);
        }

        try {
            cleanup();
        } catch (e) {
            logger.warn("Cleanup error", {
                error: e.message,
                socketId: socket.id,
            });
        }
    });
};

module.exports = (socket, activeSessions) => {
    // initialize token bucket for this socket
    submissionToken.set(socket.id, MAX_TOKENS);

    const refill = setInterval(() => {
        const curr = submissionToken.get(socket.id) ?? MAX_TOKENS;
        submissionToken.set(socket.id, Math.min(curr + 1, MAX_TOKENS));
    }, REFILL_RATE);

    socket.on("run", (data) => {
        // Step 1 — rate limit check
        const tokens = submissionToken.get(socket.id) ?? MAX_TOKENS;
        if (tokens <= 0) {
            logger.warn("Socket submission limit exceeded", {
                socketId: socket.id,
            });
            socket.emit(
                "LTE-interactive",
                "Submission limit exhausted — wait a moment",
            );
            return;
        }
        submissionToken.set(socket.id, Math.max(0, tokens - 1));

        // Step 2 — kill existing session if re-running
        const existing = activeSessions.get(socket.id);
        if (existing) existing.cleanup();

        // Step 3 — check concurrency
        if (activeSessions.size < MAX_CONCURRENT) {
            // slots available — spawn immediately
            logger.info("Spawning immediately", {
                socketId: socket.id,
                activeSessions: activeSessions.size,
            });
            trySpawn(socket, data, activeSessions);
        } else {
            // all slots full — add to waiting queue
            const position = waitingQueue.length + 1;

            logger.info("Added to waiting queue", {
                socketId: socket.id,
                position,
                queueLength: waitingQueue.length,
            });

            socket.emit(
                "QUEUED-interactive",
                `Server busy — you are #${position} in queue`,
            );
            waitingQueue.push({ socket, data });

            // handle disconnect while waiting in queue
            // if user closes tab while waiting, remove them from queue
            socket.once("disconnect", () => {
                const idx = waitingQueue.findIndex(
                    (item) => item.socket.id === socket.id,
                );
                if (idx !== -1) {
                    waitingQueue.splice(idx, 1); // remove from queue

                    // update positions for remaining waiters
                    waitingQueue.forEach((item, index) => {
                        item.socket.emit(
                            "QUEUED-interactive",
                            `Server busy — you are #${index + 1} in queue`,
                        );
                    });

                    logger.info("Removed disconnected socket from queue", {
                        socketId: socket.id,
                        newQueueLength: waitingQueue.length,
                    });
                }
            });
        }
    });

    // cleanup rate limit state on disconnect
    socket.on("disconnect", () => {
        clearInterval(refill);
        submissionToken.delete(socket.id);
    });
};
