const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.static(__dirname));

const players = {};
// Store world state changes (simple version: just keeping track of block changes could be complex, 
// for now we'll just relay block events)

io.on('connection', (socket) => {
    console.log('a user connected: ' + socket.id);

    // Send existing players to new player
    socket.emit('currentPlayers', players);

    // Initialize new player
    players[socket.id] = {
        x: 0,
        y: 10,
        z: 0,
        rx: 0,
        ry: 0
    };

    // Broadcast new player to everyone else
    socket.broadcast.emit('newPlayer', {
        id: socket.id,
        player: players[socket.id]
    });

    socket.on('disconnect', () => {
        console.log('user disconnected: ' + socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });

    socket.on('playerMovement', (movementData) => {
        if (players[socket.id]) {
            players[socket.id].x = movementData.x;
            players[socket.id].y = movementData.y;
            players[socket.id].z = movementData.z;
            players[socket.id].ry = movementData.ry;

            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                x: players[socket.id].x,
                y: players[socket.id].y,
                z: players[socket.id].z,
                ry: players[socket.id].ry
            });
        }
    });

    socket.on('blockUpdate', (data) => {
        socket.broadcast.emit('blockUpdate', data);
    });
});

server.listen(3000, () => {
    console.log('listening on *:3000');
});
