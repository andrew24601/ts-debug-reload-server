"use strict";
/*eslint-env node */

var http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const transpile = require('./transpile');

const hotReloadCompiled = fs.readFileSync(__dirname + "/HotReloader.js", "utf-8");

let baseDir;
let outChannel;

const existingWatchers = {

}

const mimeLookup = {
	".css": "text/css;charset=utf-8",
	".js": "text/javascript",
	".ts": "text/javascript",
	".tsx": "text/javascript",
	".html": "text/html;charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".svg": "image/svg+xml"
};

function addWatcher(path) {
    if (existingWatchers[path])
        return;
    existingWatchers[path] = true;
    fs.watch(path, (event) => {
        notifyChange(path);
    })
}


function _handleTypescriptFile(localPath, request, response) {
    if (fs.existsSync(localPath)) {
        const mtime = fs.statSync(localPath).mtime
        addWatcher(localPath);

        if (request.headers['if-modified-since']) {
            const dt = Date.parse(request.headers['if-modified-since']);
            const delta = dt - mtime.getTime();
            if (Math.abs(delta) < 2000) {
                response.writeHead(304);
                response.end("");
                return true;
            }
        }

        try {
            const content = transpile.transpileFile(localPath);

            response.setHeader("Content-Type", "text/javascript");
            response.setHeader("Last-Modified", mtime.toUTCString());
            response.setHeader("Cache-Control", "must-revalidate");
            response.end(content);
        } catch (e) {
            response.setHeader("Content-Type", "text/plain");
            response.setHeader("Last-Modified", mtime.toUTCString());
            response.setHeader("Cache-Control", "must-revalidate");
            response.writeHead(500);
            response.end(e.toString());
            outChannel(e.toString());
        }

        return true;
    }
    return false;
}

function serveTypescriptFile(path, request, response) {
    if (path.endsWith(".ts") || path.endsWith(".tsx")) {
        if (_handleTypescriptFile(path, request, response)) {
            return true;
        }
    }
    return false;
}

function serveCSSJS(path, request, response) {
    path = path.substring(0, path.length - 3);
    const css = fs.readFileSync(path, "utf-8");
    const mtime = fs.statSync(path).mtime;

    addWatcher(path);

    let content = `(function(){
const style = document.createElement('style');
style.textContent = ${JSON.stringify(css)};
document.head.appendChild(style);
})();`;

    response.setHeader("Content-Type", "text/javascript");
    response.setHeader("Last-Modified", mtime.toUTCString());
    response.setHeader("Cache-Control", "must-revalidate");
    response.end(content);

}

const requestHandler = (request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");

    let localPath = request.url.substring(1);

    const qidx = localPath.indexOf("?");
    if (qidx > 0) {
        localPath = localPath.substring(0, qidx);
    }

    localPath = path.resolve(baseDir, localPath);

    if (serveTypescriptFile(localPath, request, response)) {
        return;
    }

    if (localPath.endsWith(".css.js")) {
        serveCSSJS(localPath, request, response);
        return true;
    }

    let stats;

    if (fs.existsSync(localPath)) {
        stats = fs.statSync(localPath);
        if (stats.isDirectory()) {
            localPath += "/index.html";
            if (fs.existsSync(localPath))
                stats = fs.statSync(localPath);
            else
                stats = undefined;
        }
    }


    if (stats !== undefined) {
        addWatcher(localPath);

        const modifiedSinceRequest = request.headers["if-modified-since"];
        if (modifiedSinceRequest != null && Math.abs(new Date(modifiedSinceRequest).getTime() - stats.mtime.getTime()) < 1000) {
            response.writeHead(304);
            response.end("");
            return true;
        }

        let isHTML = false;
        if (localPath.length > 5) {
            const ext = path.extname(localPath);
            if (mimeLookup[ext]) {
                response.setHeader("Content-Type", mimeLookup[ext]);
            } else {
                response.setHeader("Content-Type", "text/plain");
            }

            isHTML = (ext === ".html");
        }
        response.setHeader("Last-Modified", stats.mtime);
        const content = fs.readFileSync(localPath);

        response.write(content);
        if (isHTML) {
            response.write("<script>" + hotReloadCompiled + "</script>");
        }
        response.end();
    } else {
        const parentFile = path.dirname(localPath);
        const parentFileExt = path.extname(parentFile);
        if ((parentFileExt === ".ts" || parentFileExt === ".tsx") && fs.existsSync(parentFile)) {
            const method = path.basename(localPath);
            const content = `<!DOCTYPE html><html>
            <head>
            </head>
            <body>
            <script type="module">
            import {${method}} from "../${path.basename(parentFile)}";
            const rv = ${method}();
            if (rv instanceof Element) {
                document.body.appendChild(rv);
            }
            </script>
            <script>${hotReloadCompiled}</script>
            </body>
            </html>`

            response.write(content);
                
            response.end();
        } else {
            response.writeHead(404);
            response.end("No such file");
        }
    }
};

let authors = [];

function broadcast(skip, msg) {
    for (let idx = 0; idx < authors.length; idx++) {
        if (authors[idx] !== skip) {
            authors[idx].connection.send(JSON.stringify([msg]));
        }
    }
}

let watchTimer = null;

let changedFiles = [];

function notifyChange(path) {
    if (changedFiles.indexOf(path) < 0) {
        changedFiles.push(path);
    }

    if (watchTimer != null)
        clearTimeout(watchTimer);
    watchTimer = setTimeout(() => {
        watchTimer = null;
        outChannel("Changes to " + changedFiles.join(","));
        broadcast(null, { k: "RESTART", files: changedFiles });
        changedFiles = [];
    }, 1000);
}

let server = null;
const liveSockets = new Map();

exports.startServer = function (port, host, rootDir, out) {
    baseDir = rootDir;
    outChannel = out;

    server = http.createServer(requestHandler);

    server.listen(port, host, (err) => {
        if (err) {
            return outChannel('something bad happened', err);
        }

        outChannel(`server is listening on ${host}:${port}`);
    });

    server.on('connection', function (socket) {
		liveSockets.set(socket, true);
		socket.on('close', ()=>liveSockets.delete(socket));
	});

    const wsServer = new WebSocket.Server({
        server
    });

    wsServer.on('connection', function (connection) {
        let author = {
            connection
        };

        authors.push(author);

        connection.on('close', function (reasonCode, description) {
            authors.splice(authors.indexOf(author), 1);
        });

        connection.on('message', function (data, id) {
            outChannel(data.utf8Data);
        });
    });
}

exports.stopServer = function() {
    server.close(()=>{
        outChannel(`server closed`);
    });
    for (const sock of liveSockets.keys()) {
        sock.terminate();
    }
    liveSockets.clear();

    server = null;
}

exports.isRunning = function() {
    return server !== null;
}