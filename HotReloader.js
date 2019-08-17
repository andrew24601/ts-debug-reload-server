(function hotReloader() {
    var logs = [];
    let connection = null;
    const captureConsole = false;

    function openServerSocket() {
        const socket = new WebSocket("ws://" + window.location.host + "/", "reload-protocol");

        socket.onopen = function (event) {
            connection = socket;
            for (const log of logs) {
                socket.send(log);
            }
            logs = [];
        };

        socket.onclose = function() {
            console.log("Lost server connection, trying to reconnect");
            setTimeout(openServerSocket, 5000);
            connection = null;
        }

        socket.onmessage = function (event) {
            const messages = JSON.parse(event.data);
            for (const message of messages) {
                if (message.k == "RESTART") {
                    window.location.reload(true);
                }
            }
        }
    }

    if (captureConsole) {
        console.log = function() {
            const formattedArgs = [];
            for (let idx = 0; idx < arguments.length; idx++) {
                const arg = arguments[idx];
                if (typeof arg === 'object') {
                    try {
                        formattedArgs.push(JSON.stringify(arg));
                    } catch {
                        formattedArgs.push("[object]");
                    }
                } else {
                    formattedArgs.push(arg);
                }
            }
            const msg = formattedArgs.join(" ");
            if (connection != null) {
                connection.send(msg);
            } else {
                logs.push(msg);
            }
        }
    }

    window.onerror = function(msg, url, line, col, error) {
        console.log("error:", url, "line: " + line, "col: " + col, ""+error)
    }

    openServerSocket();
})();
