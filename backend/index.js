// ======================================| IMPORTS |======================================
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const logger = require("./utils/logger");
const healthCheck = require("./middleware/healthCheck");
const graceShutdown = require("./utils/graceShutdown");
const { httpLimiter } = require("./middleware/rateLimiter");
const { stdinHandler } = require("./handlers/stdinHandler");
const { onCompleted, onFailed } = require("../redis/queue-events");
const interactiveHandler = require("./handlers/interactiveHandler");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.get("/health", healthCheck);
app.use(httpLimiter);
app.use(express.static(path.join(__dirname, "../frontend")));
// ==================================| IMPORTS END |=======================================

const activeSessions = new Map();

onCompleted(io);
onFailed(io);

process.on("SIGTERM", () => graceShutdown({ server, io, activeSessions }));
process.on("SIGINT", () => graceShutdown({ server, io, activeSessions }));

io.on("connection", (socket) => {
    logger.info("New client connected", { socketId: socket.id });

    stdinHandler(socket);
    interactiveHandler(socket, activeSessions);

    socket.on("disconnect", (reason) => {
        logger.info("Client disconnected", { socketId: socket.id, reason });

        const existing = activeSessions.get(socket.id);
        if (existing) existing.cleanup();
    });
});

server.listen(process.env.PORT, () => {
    logger.info(
        `Server listening at port: http://localhost:${process.env.PORT}`,
    );
});
