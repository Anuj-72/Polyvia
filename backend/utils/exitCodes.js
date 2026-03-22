// ==============| Exit Codes Only |=================

const EXIT_CODE_MAP = new Map([
    [0, null],
    [1, ["CE", "Compilation Error"]],
    [132, ["RTE", "Runtime Error — Illegal Instruction (SIGILL)"]],
    [134, ["RTE", "Runtime Error — Aborted (SIGABRT)"]],
    [136, ["RTE", "Runtime Error — Floating Point Exception (SIGFPE)"]],
    [137, ["RTE", "Runtime Limit Exceeded (Memory or CPU Limit Hit)"]],
    [139, ["RTE", "Runtime Error — Segmentation Fault (SIGSEGV)"]],
    [152, ["TLE", "Time Limit Exceeded (CPU Time)"]],
]);

module.exports = EXIT_CODE_MAP;
