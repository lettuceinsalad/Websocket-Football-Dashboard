import { WebSocket, WebSocketServer } from 'ws';

const matchSubscribers = new Map(); // matchId -> set of websocket clients

function subscribe(matchId, socket) {
    if (!matchSubscribers.has(matchId)) {
        matchSubscribers.set(matchId, new Set());
    }

    matchSubscribers.get(matchId).add(socket);
}

function unsubscribe(matchId, socket) {
    const subscribers = matchSubscribers.get(matchId);

    if (subscribers) {
        subscribers.delete(socket);
        if (subscribers.size === 0) {
            matchSubscribers.delete(matchId);
        }
    }
}

function cleanUpSubscriptions(socket) {
    for (const matchId of socket.subscriptions) {
        unsubscribe(matchId, socket);
    }
}

function broadcastToMatch(matchId, payload) {
    const subscribers = matchSubscribers.get(matchId);
    if (subscribers) {
        for (const client of subscribers) {
            sendJson(client, payload);
        }
    }
}

function handleMessage(socket, data) {
    let message;

    try {
        message = JSON.parse(data.toString());
    } catch {
        sendJson(socket, {type: 'error', message: 'Invalid JSON'});
    }

    if (message?.type === 'subscribe' && message.matchId) {
        subscribe(message.matchId, socket);
        socket.subscriptions.add(message.matchId);
        sendJson(socket, {type: 'subscribed', matchId: message.matchId});
    } else if (message?.type === 'unsubscribe' && message.matchId) {
        unsubscribe(message.matchId, socket);
        socket.subscriptions.delete(message.matchId);
        sendJson(socket, {type: 'unsubscribed', matchId: message.matchId});
    } else {
        sendJson(socket, {type: 'error', message: 'Unknown message type or missing matchId'});
    }
}

function sendJson(socket, payload) {
    if (socket.readyState !== socket.OPEN) return;

    socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss, payload) {
    for (const client of wss.clients) {
        sendJson(client, payload);
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

        socket.subscriptions = new Set();

        sendJson(socket, {type: 'welcome'});

        socket.on('message', (data) => handleMessage(socket, data));
        socket.on('error', socket.terminate());
        socket.on('close', () => cleanUpSubscriptions(socket));

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
        broadcastToAll(wss, {type: 'match_created', data: match});
    }

    function broadcastCommentary(matchId, commentary) {
        broadcastToMatch(matchId, {type: 'commentary', data: commentary});
    }

    return { broadcastMatchCreated, broadcastCommentary };
}
