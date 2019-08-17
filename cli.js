"use strict";
/*eslint-env node */

const server = require("./server");

let port = 8080;
let host = "localhost";

function printHelp() {
    console.log("Allowable parameters are:")
    console.log("--port <port number>")
}

let argidx = 2;
while (argidx < process.argv.length) {
    const arg = process.argv[argidx++];
    switch (arg) {
        case "--port":
            port = parseInt(process.argv[argidx++]);
            if (isNaN(port)) {
                console.log("Invalid port");
                process.exit(1);
            }
            break;
        case "--host":
            host = process.argv[argidx++];
            break;
        case "--help":
            printHelp();
            process.exit(0);
            break;
        case "--console":
            captureConsole = true;
            break;
        default:
            console.log("Unknown arg '" + arg + "'");
            printHelp();
            process.exit(1);
            break;
    }
}

server.startServer(port, host, process.cwd(), (msg)=>console.log(msg));
