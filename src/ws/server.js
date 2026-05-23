import { WebSocket, WebSocketServer } from 'ws';

function sendJson(socket, payload) {
    if (socket.readyState !== socket.OPEN) return;

    socket.send(JSON.stringify(payload));
}

function broadcast(wss, payload) {
    for (const client of wss.clients) {
        if (client.readyState !== client.OPEN) continue;

        client.send(JSON.stringify(payload));
    }
}

// Takes the HTTP server for REST and attaches a WebSocket server to it
export function attachWebSocketServer(server) {
    const wss = new WebSocket.Server({ 
        server, 
        path: '/ws',
        maxPayload: 1024*1024, // 1MB
    });

    wss.on('connection', (socket) => {
        // ping pong for keeping connection alive
        socket.isAlive = true;
        socket.on('pong', () => {
            socket.isAlive = true;
        });

        sendJson(socket, {type: 'welcome'});
        socket.on('error', console.error);
    });

    const interval = setInterval(() => {
        wss.clients.forEach((socket) => {
            if (socket.isAlive === false) {
                return socket.terminate();
            }
            socket.isAlive = false;
            socket.ping();
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval);
    });

    function broadcastMatchCreated(match) {
        broadcast(wss, {type: 'match_created', data: match});
    }
    return { broadcastMatchCreated };
}