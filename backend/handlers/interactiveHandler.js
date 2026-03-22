const fs = require("fs");
const pty = require("node-pty");
const crypto = require("crypto");
const logger = require("../utils/logger");
const EXIT_CODE_MAP = require("../utils/exitCodes");
const { DOCKER_INTERACTIVE_ARGS } = require("../utils/dockerCommands");

module.exports = (socket, activeSessions) => {
    socket.on("run", (data) => {
        const existing = activeSessions.get(socket.id);
        if (existing) existing.cleanup();

        socket.removeAllListeners("term:in");

        const codeID = crypto.randomUUID();
        const pathTemp = `/tmp/${codeID}`;

        fs.mkdirSync(pathTemp, { recursive: true });
        fs.writeFileSync(`${pathTemp}/main.cpp`, data.code);

        let ptyProcess;
        try {
            ptyProcess = pty.spawn(
                "docker",
                DOCKER_INTERACTIVE_ARGS(pathTemp),
                {
                    name: "xterm-color",
                    cols: 80,
                    rows: 30,
                    cwd: process.env.HOME,
                    env: process.env,
                },
            );
        } catch (error) {
            logger.error("PTY spawn failed", {
                error: error.message,
                socketId: socket.id,
            });
            fs.rmSync(pathTemp, { recursive: true, force: true });
            return;
        }

        if (!ptyProcess) return;

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
    });
};
