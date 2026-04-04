const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const util = require("util");
const crypto = require("crypto");
const { Mutex } = require("async-mutex");
const logger = require("../utils/logger");
const { exec, spawn } = require("child_process");

const execPromise = util.promisify(exec);

const createContainer = async () => {
    const name = `docker-${crypto.randomUUID()}`;

    const { stdout, stderr } = await execPromise(
        `docker run -dit \
        --name ${name} \
        --pids-limit=64 \
        --cpus="1.0" \
        --memory=256m \
        --memory-swap=256m \
        --network=none \
        --cap-drop=ALL \
        judge-interactive \
        bash`,
    );

    if (stderr) {
        logger.error("Error creating containers: ", { stderr });
        throw new Error("Container creation failed");
    }

    return stdout.trim();
};

const removeContainer = (id) => {
    return new Promise((resolve) => {
        const proc = spawn("docker", ["rm", "-f", id]);

        proc.on("close", () => {
            resolve();
        });
    });
};

class ContainerPool {
    constructor(size) {
        this.size = size;

        this.available = [];
        this.waitQueue = [];

        this.mutex = new Mutex();
    }

    async init() {
        for (let i = 0; i < this.size; i++) {
            const id = await createContainer();
            this.available.push({ id });
        }
        logger.info("Pool Initialized", { size: this.size });
    }

    async acquire() {
        return await this.mutex.runExclusive(() => {
            if (this.available.length > 0) {
                return this.available.shift();
            }

            return new Promise((resolve) => {
                this.waitQueue.push(resolve);
            });
        });
    }

    async release(container) {
        return await this.mutex.runExclusive(() => {
            if (this.waitQueue.length > 0) {
                const resolve = this.waitQueue.shift();
                resolve(container);
            } else this.available.push(container);
        });
    }

    async destroyAll() {
        for (const c of this.available) {
            await removeContainer(c.id);
            logger.info("Container destroyed", { id: c.id });
        }
    }
}

const pool = new ContainerPool(parseInt(process.env.CONTAINER_POOL_SIZE) || 4);

module.exports = pool;
