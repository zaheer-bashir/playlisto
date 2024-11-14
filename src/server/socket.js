"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocketServer = initializeSocketServer;
var socket_io_1 = require("socket.io");
var lobbies = new Map();
var socketToLobbyMap = new Map();
var userSocketMap = new Map();
function initializeSocketServer(server) {
    var io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true
        }
    });
    io.on('connection', function (socket) {
        var userId = socket.handshake.auth.userId;
        console.log('New socket connection:', {
            socketId: socket.id,
            userId,
            existingSocketMapping: Array.from(userSocketMap.entries())
        });
        if (userId) {
            var existingSocketId = userSocketMap.get(userId);
            if (existingSocketId) {
                console.log('Existing socket found for userId:', {
                    userId,
                    existingSocketId,
                    newSocketId: socket.id
                });
            }
            userSocketMap.set(userId, socket.id);
        }
        // Join lobby
        socket.on('joinLobby', function (_a) {
            var lobbyId = _a.lobbyId, playerName = _a.playerName, isHost = _a.isHost, userId = _a.userId;
            console.log('Join lobby request:', {
                socketId: socket.id,
                userId,
                playerName,
                isHost,
                lobbyId
            });
            var lobby = lobbies.get(lobbyId);
            // Check for existing player with this userId
            var existingPlayer = lobby?.players.find(function (p) { return p.userId === userId; });
            if (existingPlayer) {
                console.log('Found existing player:', {
                    userId,
                    existingPlayerId: existingPlayer.id,
                    newSocketId: socket.id
                });
                // Update the socket ID for the existing player
                existingPlayer.id = socket.id;
                if (existingPlayer.isHost) {
                    lobby.hostId = socket.id;
                }
                // Update mappings
                socketToLobbyMap.set(socket.id, lobbyId);
                userSocketMap.set(userId, socket.id);
                socket.join(lobbyId);
                io.to(lobbyId).emit('lobbyUpdate', lobby);
                return;
            }
            if (!lobby && !isHost) {
                socket.emit('error', 'Lobby not found');
                return;
            }
            var player = {
                id: socket.id,
                userId: userId,
                name: playerName,
                isReady: isHost,
                isHost: isHost
            };
            if (!lobby) {
                // Create new lobby if player is host
                lobbies.set(lobbyId, {
                    id: lobbyId,
                    players: [player],
                    hostId: socket.id
                });
            }
            else {
                // Check if player with same name already exists
                var nameExists = lobby.players.some(function (p) { return p.name === playerName && p.userId !== userId; });
                if (nameExists) {
                    socket.emit('error', 'Player name already taken');
                    return;
                }
                lobby.players.push(player);
                lobbies.set(lobbyId, lobby);
            }
            // Update mappings
            socketToLobbyMap.set(socket.id, lobbyId);
            userSocketMap.set(userId, socket.id);
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
            var foundEntry = Array.from(userSocketMap.entries())
                .find(function (entry) { return entry[1] === socket.id; });
            
            var userId = foundEntry ? foundEntry[0] : null;
            
            console.log('Socket disconnected:', {
                socketId: socket.id,
                userId,
                remainingSocketMappings: Array.from(userSocketMap.entries())
            });

            if (userId) {
                userSocketMap.delete(userId);
            }

            var lobbyId = socketToLobbyMap.get(socket.id);
            if (lobbyId) {
                var lobby = lobbies.get(lobbyId);
                if (lobby) {
                    var disconnectedPlayer = lobby.players.find(function (p) { return p.id === socket.id; });
                    if (disconnectedPlayer) {
                        setTimeout(function () {
                            var lobby = lobbies.get(lobbyId);
                            if (lobby) {
                                // Check if player has reconnected
                                var hasReconnected = userSocketMap.has(disconnectedPlayer.userId);
                                if (!hasReconnected) {
                                    lobby.players = lobby.players.filter(function (p) { return p.userId !== disconnectedPlayer.userId; });
                                    if (lobby.players.length === 0) {
                                        lobbies.delete(lobbyId);
                                    }
                                    else if (socket.id === lobby.hostId) {
                                        var newHost = lobby.players[0];
                                        newHost.isHost = true;
                                        newHost.isReady = true;
                                        lobby.hostId = newHost.id;
                                        lobbies.set(lobbyId, lobby);
                                        io.to(lobbyId).emit('lobbyUpdate', lobby);
                                    }
                                    else {
                                        lobbies.set(lobbyId, lobby);
                                        io.to(lobbyId).emit('lobbyUpdate', lobby);
                                    }
                                }
                            }
                            socketToLobbyMap.delete(socket.id);
                        }, 5000); // 5 second grace period for reconnection
                    }
                }
            }
        });
    });
    return io;
}
