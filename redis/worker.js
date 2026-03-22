const redisConnection = require("./redis-connection");
const util = require("util");
const { Worker } = require("bullmq");
const { exec } = require("child_process");

const execPromise = util.promisify(exec);

const worker = new Worker(
    "stdin-jobs",
    async (job) => {
        const pathTemp = job.data.pathTemp;
        const socketID = job.data.socketID;

        try {
            const { stdout, stderr } = await execPromise(
                `docker run -i --rm \
                  --pids-limit=64 \
                  --security-opt=no-new-privileges \
                  --cpus="1.0" \
                  --memory=256m --memory-swap=256m \
                  --network=none --ulimit cpu=5:5 \
                  -v "${pathTemp}:/code" \
                  judge-interactive \
                  bash -c "g++ /code/main.cpp -o /code/main && timeout 5s /code/main < /code/input"`,
            );

            return {
                output: stdout,
                error: stderr,
                socketID: socketID,
            };
        } catch (err) {
            return {
                output: err.stdout || "",
                error: err.stderr || err.message,
                socketID: socketID,
            };
        }
    },
    {
        connection: redisConnection,
    },
);

module.exports = worker;
