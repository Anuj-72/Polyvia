// --------------------| Basic Setup Here |---------------------

const term = new Terminal({
    cursorBlink: true,
    fontSize: 14,
    fontFamily: "monospace",
});

const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);

term.open(document.getElementById("terminal"));

fitAddon.fit();
window.addEventListener("resize", () => {
    fitAddon.fit();
});

const socket = io();

// ------------------------------------------------------------

// ==================================| Basics |==================================

let currentMode = "interactive";

const handleToggle = (mode) => {
    const otherMode = mode === "interactive" ? "stdin" : "interactive";

    // Toggle button active class
    document.getElementById(`mode-toggle-${mode}`).classList.add("active");
    document
        .getElementById(`mode-toggle-${otherMode}`)
        .classList.remove("active");

    // Show selected panel
    document.getElementById(
        mode === "interactive" ? "terminal" : "stdin-panel",
    ).style.display = mode === "interactive" ? "block" : "flex";

    // Hide other panel
    document.getElementById(
        otherMode === "interactive" ? "terminal" : "stdin-panel",
    ).style.display = "none";

    // Update global state (IMPORTANT)
    currentMode = mode;
};

document
    .getElementById("mode-toggle-interactive")
    .addEventListener("click", () => handleToggle("interactive"));

document
    .getElementById("mode-toggle-stdin")
    .addEventListener("click", () => handleToggle("stdin"));

// ================================== Basics END ==================================

// Run Button clicks -> Sending the data to the backend simply
const handleRun = () => {
    const code = document.getElementById("editor").value;

    if (currentMode == "interactive") {
        term.clear();
        socket.emit("run", { code });
    } else {
        const input = document.getElementById("stdin-input").value;
        socket.emit("stdin-run", { code, input });
    }
};

document.getElementById("runBtn").addEventListener("click", () => handleRun());

// Writing the data recieved from the backend onto xterm

socket.on("QUEUED-stdin", (message) => {
    document.getElementById("stdin-output").textContent = message;
});

socket.on("QUEUED-interactive", (message) => {
    term.clear();
    term.writeln(message);
});

socket.on("LTE-stdin", (message) => {
    document.getElementById("stdin-output").textContent = message;
});

socket.on("LTE-interactive", (message) => {
    term.writeln("\r\n" + message);
});

socket.on("RTE", (message) => {
    term.writeln(message);
});

socket.on("term:out", (data) => {
    term.write(data);
});

// Sending the data on xterm to the backend
term.onData((data) => {
    socket.emit("term:in", data);
});

socket.on("stdin-result", (data) => {
    document.getElementById("stdin-output").textContent = data.error
        ? data.error
        : data.output;
});

// --------------------------------------| Basic Event Handlers |--------------------------------------

const editor = document.getElementById("editor");

editor.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRun();
    } else if (e.key === "Tab") {
        e.preventDefault();
        const ta = e.target;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        ta.value =
            ta.value.substring(0, start) + "    " + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = start + 4;
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handleToggle(currentMode === "interactive" ? "stdin" : "interactive");
    }
});

// ---------------------------------------| End of File |------------------------------------------------
