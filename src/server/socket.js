"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocketServer = initializeSocketServer;
var socket_io_1 = require("socket.io");
var lobbies = new Map();
function initializeSocketServer(server) {
    var io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            methods: ["GET", "POST"]
        }
    });
    io.on('connection', function (socket) {
        console.log('Client connected:', socket.id);
        // Join lobby
        socket.on('joinLobby', function (_a) {
            var lobbyId = _a.lobbyId, playerName = _a.playerName, isHost = _a.isHost;
            var lobby = lobbies.get(lobbyId);
            if (!lobby && !isHost) {
                socket.emit('error', 'Lobby not found');
                return;
            }
            var player = {
                id: socket.id,
                name: playerName,
                isReady: false,
                isHost: isHost
            };
            if (!lobby) {
                // Create new lobby if player is host
                lobbies.set(lobbyId, {
                    id: lobbyId,
                    players: [player]
                });
            }
            else {
                // Add player to existing lobby
                lobby.players.push(player);
                lobbies.set(lobbyId, lobby);
            }
            socket.join(lobbyId);
            io.to(lobbyId).emit('lobbyUpdate', lobbies.get(lobbyId));
        });
        // Toggle ready status
        socket.on('toggleReady', function (_a) {
            var lobbyId = _a.lobbyId;
            var lobby = lobbies.get(lobbyId);
            if (!lobby)
                return;
            var player = lobby.players.find(function (p) { return p.id === socket.id; });
            if (player) {
                player.isReady = !player.isReady;
                lobbies.set(lobbyId, lobby);
                io.to(lobbyId).emit('lobbyUpdate', lobby);
            }
        });
        // Update playlist selection
        socket.on('updatePlaylist', function (_a) {
            var lobbyId = _a.lobbyId, playlist = _a.playlist;
            var lobby = lobbies.get(lobbyId);
            if (!lobby)
                return;
            var player = lobby.players.find(function (p) { return p.id === socket.id; });
            if (player === null || player === void 0 ? void 0 : player.isHost) {
                lobby.spotifyPlaylist = playlist;
                lobbies.set(lobbyId, lobby);
                io.to(lobbyId).emit('lobbyUpdate', lobby);
            }
        });
        // Start game
        socket.on('startGame', function (_a) {
            var lobbyId = _a.lobbyId;
            var lobby = lobbies.get(lobbyId);
            if (!lobby)
                return;
            var player = lobby.players.find(function (p) { return p.id === socket.id; });
            if ((player === null || player === void 0 ? void 0 : player.isHost) && lobby.players.every(function (p) { return p.isReady; })) {
                io.to(lobbyId).emit('gameStart', lobby.spotifyPlaylist);
            }
        });
        // Handle disconnection
        socket.on('disconnect', function () {
            for (var _i = 0, _a = lobbies.entries(); _i < _a.length; _i++) {
                var _b = _a[_i], lobbyId = _b[0], lobby = _b[1];
                var playerIndex = lobby.players.findIndex(function (p) { return p.id === socket.id; });
                if (playerIndex !== -1) {
                    lobby.players.splice(playerIndex, 1);
                    if (lobby.players.length === 0) {
                        lobbies.delete(lobbyId);
                    }
                    else {
                        // If host disconnected, assign new host
                        if (lobby.players.every(function (p) { return !p.isHost; })) {
                            lobby.players[0].isHost = true;
                        }
                        lobbies.set(lobbyId, lobby);
                        io.to(lobbyId).emit('lobbyUpdate', lobby);
                    }
                    break;
                }
            }
        });
    });
    return io;
}
