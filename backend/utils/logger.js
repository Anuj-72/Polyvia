const { createLogger, format, transports } = require("winston");
const path = require("path");

const logger = createLogger({
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
    format: format.combine(
        format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
        format.errors({ stack: true }),
        format.json(),
    ),
    transports: [
        // always log to console
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.printf(({ timestamp, level, message, ...meta }) => {
                    return `[${timestamp}] ${level}: ${message} ${
                        Object.keys(meta).length ? JSON.stringify(meta) : ""
                    }`;
                }),
            ),
        }),

        // in production, also log to files
        ...(process.env.NODE_ENV === "production"
            ? [
                  new transports.File({
                      filename: path.join(__dirname, "../../logs/error.log"),
                      level: "error",
                  }),
                  new transports.File({
                      filename: path.join(__dirname, "../../logs/combined.log"),
                  }),
              ]
            : []),
    ],
});

module.exports = logger;
