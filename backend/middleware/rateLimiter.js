const rateLimit = require("express-rate-limit");
const logger = require("../utils/logger");

// HTTP rate limiter — for all HTTP requests
const httpLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 30, // max 30 HTTP requests per minute per IP
    standardHeaders: true, // return rate limit info in headers
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn("HTTP rate limit exceeded", { ip: req.ip });
        res.status(429).json({
            error: "Too many requests, slow down",
        });
    },
});

// Submission rate limiter — stricter, for run endpoints
const submissionLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute window
    max: 10, // max 10 submissions per minute per IP
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn("Submission rate limit exceeded", { ip: req.ip });
        res.status(429).json({
            error: "Too many submissions, wait a moment",
        });
    },
});

module.exports = { httpLimiter, submissionLimiter };
