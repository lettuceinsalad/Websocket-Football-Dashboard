import dotenv from 'dotenv';
import express from 'express';
import http from 'http';
import { matchRouter } from './routes/matches.js';
import { attachWebSocketServer } from './ws/server.js';

dotenv.config();

const port = Number(process.env.PORT) || 8000;
const host = process.env.HOST || '0.0.0.0';

const app = express();
const server = http.createServer(app);

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.use('/matches', matchRouter);

const { broadcastMatchCreated } = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;

server.listen(port, () => {
    const baseUrl = host === '0.0.0.0' ? 'http://localhost:${port}' : `http://${host}:${port}`;
    console.log(`Server is running on ${baseUrl}`);
});
