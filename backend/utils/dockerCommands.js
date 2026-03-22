const DOCKER_INTERACTIVE_ARGS = (pathTemp) => [
    "run",
    "-i",
    "--rm",
    "--memory",
    "256m",
    "--memory-swap",
    "256m",
    "--ulimit",
    "cpu=5:5",
    "--pids-limit",
    "64",
    "--security-opt",
    "no-new-privileges",
    "--cpus",
    "1.0",
    "--network",
    "none",
    "--cap-drop",
    "ALL",
    "-v",
    `${pathTemp}/main.cpp:/code/main.cpp`,
    "judge-interactive",
    "bash",
    "-c",
    "g++ /code/main.cpp -o /tmp/main && /tmp/main",
];

const DOCKER_STDIN_COMMAND = (pathTemp) =>
    `docker run --rm \
    --pids-limit=64 \
    --security-opt=no-new-privileges \
    --cpus="1.0" \
    --memory=256m --memory-swap=256m \
    --network=none --ulimit cpu=5:5 \
    --cap-drop=ALL \
    -v "${pathTemp}:/code" \
    judge-interactive \
    bash -c "g++ /code/main.cpp -o /tmp/main && timeout 5s /tmp/main < /code/input"`;

module.exports = { DOCKER_INTERACTIVE_ARGS, DOCKER_STDIN_COMMAND };
