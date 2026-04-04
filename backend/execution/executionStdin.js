/*  executionStdin.js

#.  What I did here -
1.  We've containerID of docker container acquired and the path where user's { code, input } exists.
2.  Copy the files FROM: Host -> Container
3.  Compile the code and capture the output
4.  Cleanup - IMPORTANT: Remove the copied files from container in all scenarios.
*/

const util = require("util");
const { exec } = require("child_process");
const execPromise = util.promisify(exec);

// Step 1
module.exports = async (containerID, pathTemp) => {
    try {
        // Step 2
        await execPromise(`docker cp ${pathTemp}/. ${containerID}:${pathTemp}`);

        // Step 3
        const { stdout, stderr } = await execPromise(
            `docker exec ${containerID} bash -c "g++ ${pathTemp}/main.cpp -o /tmp/main && timeout 5s /tmp/main < ${pathTemp}/input"`,
        ); // Step 3

        return { stdout, stderr };
    } catch (err) {
        return {
            stdout: err.stdout || "",
            stderr: err.stderr || err.message,
        };
    } finally {
        // Step 4
        await execPromise(
            `docker exec ${containerID} rm -rf ${pathTemp}`,
        ).catch(() => {});
    }
};
